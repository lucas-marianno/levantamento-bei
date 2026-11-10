
# TODO
[] replace CPF with cargo
[] modify the existing fields for as documented bellow

## Identifier

| field | Mandatory | type | note |
| -- | -- | -- | -- |
| name | T  | str | [a-z] upper_case |
| matrícula | T  | 5 digit number | -- |
| role | T | dropdown | Oficial de Escola, Funcionário Readaptado, Diretor, Vice-diretor, Coordenador |
| EMEB | T  | dropdown | List with all 178 EMEBs |


## Columns

| column | Mandatory | type | note |
| -- | -- | -- | -- |
| Title | T | str | * |
| Author | T  | str | * |
| Publisher | T  | str | * |
| ISBN | T  | -- | Fetches an API** when complete, then updates * fields |
| Does't have ISBN | F | checkbox | -- |
| Label color | T | dropdown | branca, amarela, azul, laranja, preta, verde, vermelha |
| CDD*** | F | dropdown | pending: stakeholder will send the list **** |
| Unclassified | F | checkbox | -- |
| Is reference work | F | checkbox | -- |
| Theme selector  | T | dropdown | pending: stakeholder will send the list |
| Quantity. | T | integer | -- |
| Delete entry | -- | button | Should display a warning before deleting a row |

* auto-filled (disabled unless `Doesn't have ISBN`is checked)
** Must investigate how feasible is that. There are public APIs that can be called, but there might be some request limits.
*** on hover info should mention that the reference codes can be found at (p. 112-130): https://educacao.saobernardo.sp.gov.br/images/bei/Guia_de_Gerenciamento_da_BEI_2026_07072026.pdf
****  Should only enforce when the selected label color is orange.  

# Notes
index URL: file:///C:/Users/42670/git-clones/clasp/bei/index.html

## Api notes 
Doc: https://developers.google.com/books/docs/v1/using?hl=pt-br
Sample query: https://www.googleapis.com/books/v1/volumes?q=isbn:9788583400431
Web url search: https://www.cblservicos.org.br/isbn/pesquisa/?page=1&q=9788583400431&filtrar_por%5B0%5D=isbn&ord%5B0%5D=relevancia&dir%5B0%5D=asc

