# Context
The stakeholder changed its mind due to time constraints, and possible issues with the staff that will be dealing with this website.

We'll need to modify the website to make it simpler and avoid friction with staff.

I have forked this codebase so that we can make changes and avoid affecting the current website. The working tree is clean

# website v3 specs

## What continues as is
- The entire "Identificação" block.

## What gets replaced
- The entire "Livros" block.

## Whats new

### Form block
We basically need a form. Just add row for each CDD and its color (eg. (100-200) AMARELO - Filosofia e Religião). and an input field for "Quantidade de exemplares"
Once again, this should be derived from the options.json file.

### Theme blocks
These blocks will be similar to the previous "Livros" block. Scavage as much as possible from it. Or just rename it and delete whats not needed anymore... your choice.
For the time being we are only going to need two (Temática Indígena and Temática Africana), but there might be more in the future. In case that the stakeholder changes its mind, generate both blocks from the options.json (add another entry to it with both themes i wrote above for the time being)

#### Layout
Only the data collums bellow remain:
Title | Author | publisher | quantity

The collum with the delete button and save status remain unchanged.

#### collum logic
They remain unchanged from livros block for the remaining collums. All others should be ignored

#### block logic
They remain the same. What i mean by that is that the blocks should begin with the same row quantity, deleting rows with data should display the same errors, etc.

### Saving
Move the save button out of the livros block. it should be after the theme blocks.

### Deprecation
A lot of the previous logic will no longer be used. But don't delete it, only mark them as deprecated and add a note to the top of the file explaining the deprated code.
I am opting for deprecating instead of deleting because the stakeholder is not stable and we might need to revert some changes

## Finally
I haven't thought of everything and I might have overlooked something. If that's the case, let me know before proceeding.

Once again, write a plan first, I'll revise it before proceeding
