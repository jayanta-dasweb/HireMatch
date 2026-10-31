-- Dedicated database for pytest (created on first Postgres volume init)
SELECT 'CREATE DATABASE hirematch_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hirematch_test')\gexec
