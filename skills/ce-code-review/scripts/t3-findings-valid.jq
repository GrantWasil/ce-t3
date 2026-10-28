# Validate the schema vocabulary used by the bundled findings schemas. Unknown
# validation keywords fail closed so schema changes cannot silently weaken this.
def matches_type($kind):
  if $kind == "integer" then type == "number" and floor == .
  else type == $kind end;
def conforms($s):
  . as $value |
  all($s | keys[]; IN("$schema", "title", "description", "type", "required", "properties", "items", "enum", "minimum", "minItems", "maxLength")) and
  (if $s.type == null then true
   elif ($s.type | type) == "array" then any($s.type[]; . as $kind | $value | matches_type($kind))
   else matches_type($s.type) end) and
  (if $s.enum == null then true else ($s.enum | index($value)) != null end) and
  (if $s.minimum == null then true else . >= $s.minimum end) and
  (if $s.minItems == null then true else length >= $s.minItems end) and
  (if $s.maxLength == null then true else length <= $s.maxLength end) and
  all($s.required[]?; . as $key | $value | has($key)) and
  all(($s.properties // {} | to_entries[]);
      .key as $key | .value as $child |
      $value | if has($key) then .[$key] | conforms($child) else true end) and
  (if $s.items == null then true else all(.[]; conforms($s.items)) end);
conforms($schema[0])
