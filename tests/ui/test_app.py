import functools
import http.server
import os
import threading
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class AppUiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(
            target=cls.server.serve_forever, daemon=True
        )
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}/"

        cls.playwright = sync_playwright().start()
        cls.browser = cls._launch_browser()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)

    @classmethod
    def _launch_browser(cls):
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")

        if not executable:
            cached = sorted(
                Path.home().glob(
                    ".cache/ms-playwright/chromium-*/chrome-linux64/chrome"
                ),
                reverse=True,
            )
            if cached:
                executable = str(cached[0])

        options = {"headless": True}
        if executable:
            options["executable_path"] = executable

        return cls.playwright.chromium.launch(**options)

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={"width": 1440, "height": 1200}
        )
        self.page = self.context.new_page()
        self.console_errors = []
        self.page.on("pageerror", lambda error: self.console_errors.append(str(error)))
        self.page.on(
            "console",
            lambda message: (
                self.console_errors.append(message.text)
                if message.type == "error"
                else None
            ),
        )
        self.page.goto(self.base_url, wait_until="networkidle")

    def tearDown(self):
        self.assertEqual(self.console_errors, [])
        self.context.close()

    def fill_identification(self, name="Maria", cargo="Diretor", matricula="12345"):
        self.page.fill("#responsavel", name)
        self.page.locator("#responsavel").blur()
        self.page.select_option("#cargo", cargo)
        self.page.fill("#matricula", matricula)
        self.page.locator("#matricula").blur()

    def select_school(self, index=1):
        self.page.select_option("#escola", index=index)

    def fill_theme_rows(self, block_index=0):
        block = self.page.locator(".theme-block").nth(block_index)
        rows = block.locator("tbody tr")
        count = rows.count()

        for index in range(count):
            row = rows.nth(index)
            row.locator('[data-column-key="titulo"]').fill(f"Livro {index}")
            row.locator('[data-column-key="autor"]').fill(f"Autor {index}")
            row.locator('[data-column-key="editora"]').fill(f"Editora {index}")
            quantity = row.locator('[data-column-key="quantidade"]')
            quantity.fill("2")
            quantity.dispatch_event("change")

    def test_initial_render(self):
        page = self.page
        self.assertEqual(page.title(), "Registro de Livros")
        self.assertEqual(page.locator("#escola option").count(), 179)
        self.assertEqual(page.locator("#cdd-form-body tr").count(), 8)
        self.assertEqual(page.locator(".theme-block").count(), 2)
        self.assertEqual(page.locator(".theme-table tbody tr").count(), 10)
        self.assertTrue(page.locator("#cdd-form-section").is_hidden())
        self.assertTrue(page.locator("#save-section").is_hidden())
        self.assertEqual(
            page.eval_on_selector(
                "#submit-survey-v3",
                "element => getComputedStyle(element).backgroundColor",
            ),
            "rgb(54, 92, 170)",
        )
        self.assertIn(
            "Parkinsans",
            page.eval_on_selector(
                "body", "element => getComputedStyle(element).fontFamily"
            ),
        )
        self.assertTrue(
            page.evaluate(
                "async () => { await document.fonts.ready; return document.fonts.check('16px Parkinsans'); }"
            )
        )

    def test_identification_validation_and_sanitization(self):
        page = self.page

        page.fill("#responsavel", "josé  da silva")
        page.locator("#responsavel").blur()
        self.assertEqual(page.input_value("#responsavel"), "JOSE DA SILVA")

        self.assertEqual(page.get_attribute("#responsavel", "aria-invalid"), "false")
        self.assertTrue(page.locator("#escola").is_disabled())

        page.select_option("#cargo", "Oficial de Escola")
        page.fill("#matricula", "12a3456")
        page.locator("#matricula").blur()

        self.assertEqual(page.input_value("#matricula"), "12345")
        self.assertFalse(page.locator("#escola").is_disabled())
        self.assertTrue(page.locator("#escola-hint").is_hidden())
        self.assertTrue(page.locator("#matricula-error").is_hidden())

    def test_school_selection_shows_sections_and_restores_draft(self):
        page = self.page

        self.fill_identification()
        school = page.locator("#escola option").nth(1).get_attribute("value")
        self.select_school()

        self.assertFalse(page.locator("#cdd-form-section").is_hidden())
        self.assertFalse(page.locator("#save-section").is_hidden())
        self.assertEqual(page.locator(".theme-block:visible").count(), 2)

        draft = page.evaluate(
            "() => JSON.parse(localStorage.getItem('registro-livros:v3:draft'))"
        )
        self.assertEqual(draft["version"], 3)
        self.assertEqual(draft["school"], school)
        self.assertEqual(draft["form"]["responsavel"], "MARIA")
        self.assertEqual(draft["form"]["matricula"], "12345")

        page.reload(wait_until="networkidle")

        self.assertEqual(page.input_value("#escola"), school)
        self.assertEqual(page.input_value("#responsavel"), "MARIA")
        self.assertEqual(page.input_value("#matricula"), "12345")
        self.assertFalse(page.locator("#cdd-form-section").is_hidden())
        self.assertFalse(page.locator("#save-section").is_hidden())
        self.assertEqual(page.locator(".theme-table tbody tr").count(), 10)

    def test_cdd_and_theme_row_interactions(self):
        page = self.page
        self.fill_identification()
        self.select_school()

        first_quantity = page.locator(".cdd-quantity-input").nth(0)
        first_quantity.fill("3")
        first_quantity.dispatch_event("change")
        expect(page.locator("#cdd-form-status")).to_have_text("Entrada não salva")

        second_checkbox = page.locator(".cdd-unavailable-checkbox").nth(1)
        second_checkbox.check()
        second_quantity = page.locator(".cdd-quantity-input").nth(1)
        self.assertTrue(second_quantity.is_disabled())
        self.assertEqual(second_quantity.input_value(), "0")

        first_block = page.locator(".theme-block").nth(0)
        self.assertEqual(first_block.locator("tbody tr").count(), 5)

        self.fill_theme_rows(block_index=0)

        expect(first_block.locator("tbody tr")).to_have_count(6)
        expect(
            first_block.locator("tbody tr").nth(0).locator(".save-status")
        ).to_have_text("Entrada não salva")

        second_block = page.locator(".theme-block").nth(1)
        self.assertEqual(second_block.locator("tbody tr").count(), 5)
        second_block.locator("tbody tr").nth(2).locator(".delete-row-button").click()
        expect(second_block.locator("tbody tr")).to_have_count(4)

        first_block.locator("tbody tr").nth(0).locator(".delete-row-button").click()
        expect(page.locator("#delete-row-dialog")).to_be_visible()
        page.click("#cancel-delete-row")
        expect(page.locator("#delete-row-dialog")).to_be_hidden()
        expect(first_block.locator("tbody tr")).to_have_count(6)

        first_block.locator("tbody tr").nth(0).locator(".delete-row-button").click()
        page.click("#confirm-delete-row")
        expect(first_block.locator("tbody tr")).to_have_count(5)

        page.locator(".theme-block").nth(1).locator(".add-theme-rows").click()
        expect(second_block.locator("tbody tr")).to_have_count(14)

    def test_save_validation_then_success(self):
        page = self.page
        self.fill_identification()
        self.select_school()

        african_block = page.locator(".theme-block").nth(1)
        african_block.locator("tbody tr").nth(0).locator(
            '[data-column-key="titulo"]'
        ).fill("Livro parcial")

        page.click("#submit-survey-v3")
        expect(page.locator("#survey-feedback-v3")).to_contain_text(
            "Linhas parcialmente preenchidas"
        )
        expect(page.locator("#survey-feedback-v3")).to_contain_text(
            "Temática Africana: 1"
        )
        self.assertIn(
            "row-incomplete",
            african_block.locator("tbody tr").nth(0).get_attribute("class"),
        )

        row = african_block.locator("tbody tr").nth(0)
        row.locator('[data-column-key="autor"]').fill("Autor")
        row.locator('[data-column-key="editora"]').fill("Editora")
        quantity = row.locator('[data-column-key="quantidade"]')
        quantity.fill("2")
        quantity.dispatch_event("change")

        page.click("#submit-survey-v3")
        expect(page.locator("#survey-feedback-v3")).to_contain_text(
            "Informe uma quantidade maior que 0"
        )
        expect(page.locator("#survey-feedback-v3")).to_contain_text("000-099")
        self.assertEqual(
            page.locator(".cdd-quantity-input").nth(0).get_attribute("aria-invalid"),
            "true",
        )

        boxes = page.locator(".cdd-unavailable-checkbox")
        for index in range(boxes.count()):
            boxes.nth(index).check()

        page.click("#submit-survey-v3")
        expect(page.locator("#survey-feedback-v3")).to_have_text(
            "Levantamento salvo com sucesso."
        )
        self.assertIn(
            "success", page.locator("#survey-feedback-v3").get_attribute("class")
        )
        expect(page.locator("#cdd-form-status")).to_contain_text("Salvo em")
        self.assertEqual(
            page.locator("#submit-survey-v3").text_content().strip(), "Salvar"
        )

        draft = page.evaluate(
            "() => JSON.parse(localStorage.getItem('registro-livros:v3:draft'))"
        )
        self.assertTrue(draft["cddMeta"]["savedAt"])
        self.assertFalse(draft["cddMeta"]["saveError"])

    def test_school_change_dialog_cancel_and_confirm(self):
        page = self.page
        self.fill_identification()
        self.select_school(index=1)

        first_school = page.locator("#escola").input_value()
        first_quantity = page.locator(".cdd-quantity-input").nth(0)
        first_quantity.fill("3")
        first_quantity.dispatch_event("change")

        self.select_school(index=2)
        expect(page.locator("#school-change-dialog")).to_be_visible()
        page.click("#cancel-school-change")

        expect(page.locator("#school-change-dialog")).to_be_hidden()
        self.assertEqual(page.locator("#escola").input_value(), first_school)
        self.assertEqual(page.locator(".cdd-quantity-input").nth(0).input_value(), "3")
        page.wait_for_timeout(50)

        self.select_school(index=2)
        expect(page.locator("#school-change-dialog")).to_be_visible()
        page.click("#confirm-school-change")
        expect(page.locator("#school-change-dialog")).to_be_hidden()

        selected_school = page.locator("#escola").input_value()
        self.assertNotEqual(selected_school, first_school)
        self.assertTrue(
            all(
                page.locator(".cdd-quantity-input").nth(index).input_value() == "0"
                for index in range(page.locator(".cdd-quantity-input").count())
            )
        )
        self.assertEqual(page.locator(".theme-table tbody tr").count(), 10)

        draft = page.evaluate(
            "() => JSON.parse(localStorage.getItem('registro-livros:v3:draft'))"
        )
        self.assertEqual(draft["school"], selected_school)
        self.assertTrue(all(item["quantidade"] == 0 for item in draft["cdd"]))

    def test_cdd_tooltip_opens_and_closes_with_escape(self):
        page = self.page
        self.fill_identification()
        self.select_school()

        page.click("#cdd-form-info-button")
        expect(page.locator("#cdd-tooltip")).to_be_visible()
        self.assertEqual(
            page.get_attribute("#cdd-form-info-button", "aria-expanded"), "true"
        )

        page.keyboard.press("Escape")
        expect(page.locator("#cdd-tooltip")).to_be_hidden()
        self.assertEqual(
            page.get_attribute("#cdd-form-info-button", "aria-expanded"), "false"
        )


if __name__ == "__main__":
    unittest.main()
