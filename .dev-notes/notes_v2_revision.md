# v2 revision

1. The page need to fill the entire available space. The current central block only is not working anymore with the width of the Livros table.

2. After ISBN is filled and the user shift focus, just return this info for the time being:"Título do livro de exemplo", "Autor Exemplo", "Editora de Exemplo". so that we can test the save button
Also, add a stub function that will validade the ISBN number before sending  (stub + todo, return true for the time being)
Also, add a api requests throtle. If should only send a new request after a given delay (add that to options.json for easy changing later) (again. only stub + todo)
