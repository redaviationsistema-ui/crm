const PRODUCTION_PROJECT_REFS=new Set(['hhlicjgpwcesytziacvc'])

export function habilitarPasswordWritesAdmin({projectRef,writesEnabled,passwordWritesValidated,productionAuthorized}={}){
  return /^[a-z]{20}$/.test(projectRef)&&writesEnabled===true&&passwordWritesValidated===true&&
    (!PRODUCTION_PROJECT_REFS.has(projectRef)||productionAuthorized===true)
}
