import { cleanEnv, str, url } from 'envalid'

export function loadAndValidateEnv() {
  return cleanEnv(process.env, {
    DATABASE_URL: url({ desc: 'Postgres Database URL' }),
    REGULATIONS_API_KEY: str({ desc: 'Regulations.gov REST API key' }),
    REGULATIONS_OPEN_API_SPEC_URL: url({
      desc: 'Regulations.gov OpenAPI specification URL',
    }),
  })
}
