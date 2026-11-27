SELECT
  oid::int AS type_oid,
  typname AS type_name,
  typtype::text AS type_kind,
  typbasetype::int AS base_type_oid,
  typelem::int AS element_type_oid,
  typcategory::text AS type_category
FROM pg_type;
