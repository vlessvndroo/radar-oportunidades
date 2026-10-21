-- 003: cada fuente apunta al workflow de n8n que la recolecta (su conector).
-- main-daily llama al conector por este id, así agregar una fuente es crear
-- su conector y su fila en sources, sin tocar main-daily (RF-1).
ALTER TABLE sources ADD COLUMN connector_workflow_id text;
