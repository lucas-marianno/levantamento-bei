[English](README.md)

# Levantamento do acervo das bibliotecas escolares de São Bernardo do Campo

Este projeto é um formulário usado pela Secretaria de Educação de São Bernardo do Campo para registrar os livros disponíveis nas bibliotecas das escolas municipais.

Um responsável da escola se identifica, escolhe sua EMEB e informa quantos livros a unidade possui em cada classificação da biblioteca. O formulário também pergunta sobre livros ligados às temáticas indígena e africana, ou se a escola não possui acervo com essa temática.

O objetivo é dar à Secretaria de Educação uma visão clara e uniforme do acervo de cada escola. Com essas informações, a Secretaria pode planejar melhor o apoio, os recursos e as ações voltadas a estudantes e professores.

Este formulário foi pensado inicialmente para uso em um único período de coleta. Ele não foi projetado como um sistema permanente.

## Tecnologias usadas

- Frontend: HTML, CSS e módulos JavaScript puros, sem framework e sem etapa de build.
- Backend: Supabase Edge Functions escritas em TypeScript.
- Dados: uma única tabela no Postgres do Supabase, com segurança em nível de linha habilitada.
- Rascunhos: salvos localmente no navegador enquanto a pessoa preenche o formulário.
- Testes: o executor de testes nativo do Node e testes de navegador com Playwright.
- Requisições de API: uma pequena coleção Bruno para chamar as Edge Functions.

## Restrições durante o desenvolvimento

O projeto foi desenvolvido com recursos limitados e sob um prazo muito apertado. Não foram usadas APIs ou hospedagem pagas, e apenas ferramentas gratuitas foram utilizadas ao longo do trabalho.

>[!NOTE]
>
> Este projeto foi desenvolvido por Lucas Mariano com uso extensivo de codificação agêntica para acelerar o desenvolvimento e tornar esse projeto possível dentro do prazo e com os recursos disponíveis.
