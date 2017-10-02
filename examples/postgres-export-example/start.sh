#!/bin/sh

# database connection URI
export DB_CONNECTION=postgres://jodel:jodel@localhost:5432/jodel_export_example
node postgres-export-example.js
