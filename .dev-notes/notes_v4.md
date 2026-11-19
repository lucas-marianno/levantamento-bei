now we need to work on migrating data/options.json into supabase:

I already deleted some deprecated lines (used in v0.2)

# What needs to be moved into supabase
- cddCategories
- themes
> new tables need to be created to store those items, as well as edge functions to fetch them

# What needs to be fetched from supabase
- schools (can be fetched from the table user_whitelist by selecting the unique values in the column `UNIDADE_EXERCICIO` that end with the string ` - EMEB` )
- collectionPeriod
