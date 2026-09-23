import re

with open('model/migrations.ts', 'r', encoding='utf-8') as f:
    migrations = f.read()

# Fix duplicates
# Pattern looks for { name: 'server_revision' ... }, { name: 'updated_at' ... }, { name: 'server_revision' ... }
pattern = r"\{\s*name:\s*'server_revision',\s*type:\s*'number',\s*isOptional:\s*true\s*\},[\s\n]*\{\s*name:\s*'updated_at',\s*type:\s*'number'\s*\},[\s\n]*\{\s*name:\s*'server_revision',\s*type:\s*'number',\s*isOptional:\s*true\s*\}"
replacement = "{ name: 'updated_at', type: 'number' },\n                        { name: 'server_revision', type: 'number', isOptional: true }"
migrations = re.sub(pattern, replacement, migrations)

# Add v4 migration
v4 = '''        {
            toVersion: 4,
            steps: [
                addColumns({
                    table: 'evidence',
                    columns: [
                        { name: 'source_type', type: 'string', isOptional: true },
                        { name: 'provider_id', type: 'string', isOptional: true },
                        { name: 'provider_record_id', type: 'string', isOptional: true },
                        { name: 'source_name', type: 'string', isOptional: true },
                        { name: 'source_url', type: 'string', isOptional: true },
                        { name: 'metric_name', type: 'string', isOptional: true },
                        { name: 'numeric_value', type: 'string', isOptional: true },
                        { name: 'text_value', type: 'string', isOptional: true },
                        { name: 'boolean_value', type: 'boolean', isOptional: true },
                        { name: 'observation_date', type: 'number', isOptional: true },
                        { name: 'retrieved_at', type: 'number', isOptional: true },
                        { name: 'state', type: 'string', isOptional: true },
                        { name: 'district', type: 'string', isOptional: true },
                        { name: 'commodity', type: 'string', isOptional: true },
                        { name: 'market_id', type: 'string', isOptional: true },
                        { name: 'market_name', type: 'string', isOptional: true },
                        { name: 'price_type', type: 'string', isOptional: true },
                        { name: 'currency', type: 'string', isOptional: true },
                        { name: 'quantity_unit', type: 'string', isOptional: true },
                        { name: 'content_hash', type: 'string', isOptional: true },
                        { name: 'derivation_type', type: 'string', isOptional: true },
                        { name: 'derivation_version', type: 'string', isOptional: true }
                    ],
                }),
            ],
        },
'''
migrations = migrations.replace('migrations: [', 'migrations: [\n' + v4)

with open('model/migrations.ts', 'w', encoding='utf-8') as f:
    f.write(migrations)

with open('model/schema.ts', 'r', encoding='utf-8') as f:
    schema = f.read()

schema = schema.replace('version: 3', 'version: 4')

schema_repl = '''
                { name: 'source_type', type: 'string', isOptional: true },
                { name: 'provider_id', type: 'string', isOptional: true },
                { name: 'provider_record_id', type: 'string', isOptional: true },
                { name: 'source_name', type: 'string', isOptional: true },
                { name: 'source_url', type: 'string', isOptional: true },
                { name: 'metric_name', type: 'string', isOptional: true },
                { name: 'numeric_value', type: 'string', isOptional: true },
                { name: 'text_value', type: 'string', isOptional: true },
                { name: 'boolean_value', type: 'boolean', isOptional: true },
                { name: 'observation_date', type: 'number', isOptional: true },
                { name: 'retrieved_at', type: 'number', isOptional: true },
                { name: 'state', type: 'string', isOptional: true },
                { name: 'district', type: 'string', isOptional: true },
                { name: 'commodity', type: 'string', isOptional: true },
                { name: 'market_id', type: 'string', isOptional: true },
                { name: 'market_name', type: 'string', isOptional: true },
                { name: 'price_type', type: 'string', isOptional: true },
                { name: 'currency', type: 'string', isOptional: true },
                { name: 'quantity_unit', type: 'string', isOptional: true },
                { name: 'content_hash', type: 'string', isOptional: true },
                { name: 'derivation_type', type: 'string', isOptional: true },
                { name: 'derivation_version', type: 'string', isOptional: true },\\2'''

schema = re.sub(r"(name:\s*'evidence',\s*columns:\s*\[[\s\S]*?)(\s*\]\s*,\s*\})", schema_repl.replace('\\2', r'\2'), schema)

with open('model/schema.ts', 'w', encoding='utf-8') as f:
    f.write(schema)

