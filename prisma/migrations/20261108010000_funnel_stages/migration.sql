-- Embudo de 11 etapas para inmobiliarias. Los pipelines creados con las 6 etapas iniciales
-- se convierten conservando los ids (los negocios siguen ligados a su etapa) y se agregan
-- las etapas que faltan. Solo toca pipelines que aún tienen las etapas por defecto antiguas.

-- 1) Renombrar las etapas antiguas a su equivalente (el orden se reasigna en el paso 3).
UPDATE "pipeline_stages" SET "name" = 'Nuevo Lead'          WHERE "name" = 'Nuevo';
UPDATE "pipeline_stages" SET "name" = 'Lead respondido'     WHERE "name" = 'Calificado';
UPDATE "pipeline_stages" SET "name" = 'Cita programada'     WHERE "name" = 'Visita Agendada';
UPDATE "pipeline_stages" SET "name" = 'Seguimiento'         WHERE "name" = 'Visitó Propiedad';
UPDATE "pipeline_stages" SET "name" = 'Decisión de compra'  WHERE "name" = 'En Negociación';

-- 2) Insertar las etapas nuevas en los pipelines que ya tienen "Nuevo Lead".
INSERT INTO "pipeline_stages" ("id", "pipelineId", "name", "order", "color", "probability")
SELECT gen_random_uuid()::text, p."id", s.name, 0, s.color, s.probability
FROM "pipelines" p
CROSS JOIN (VALUES
  ('Reactivación',        '#64748b', 5),
  ('No Responde',         '#9ca3af', 10),
  ('Información Enviada', '#14b8a6', 40),
  ('Reagendar cita',      '#eab308', 45),
  ('Cierre',              '#22c55e', 95)
) AS s(name, color, probability)
WHERE EXISTS (SELECT 1 FROM "pipeline_stages" x WHERE x."pipelineId" = p."id" AND x."name" = 'Nuevo Lead')
  AND NOT EXISTS (SELECT 1 FROM "pipeline_stages" y WHERE y."pipelineId" = p."id" AND y."name" = s.name);

-- 3) Orden, color y probabilidad finales de las 11 etapas.
UPDATE "pipeline_stages" ps SET "order" = v.ord, "color" = v.color, "probability" = v.prob
FROM (VALUES
  ('Nuevo Lead',          0, '#3b82f6', 5),
  ('Reactivación',        1, '#64748b', 5),
  ('Contactado',          2, '#8b5cf6', 15),
  ('No Responde',         3, '#9ca3af', 10),
  ('Lead respondido',     4, '#06b6d4', 30),
  ('Información Enviada', 5, '#14b8a6', 40),
  ('Reagendar cita',      6, '#eab308', 45),
  ('Cita programada',     7, '#f97316', 60),
  ('Seguimiento',         8, '#ec4899', 65),
  ('Decisión de compra',  9, '#ef4444', 80),
  ('Cierre',             10, '#22c55e', 95)
) AS v(name, ord, color, prob)
WHERE ps."name" = v.name
  AND EXISTS (SELECT 1 FROM "pipeline_stages" z WHERE z."pipelineId" = ps."pipelineId" AND z."name" = 'Nuevo Lead');

-- 4) Etapa en texto de los leads existentes.
UPDATE "leads" SET "stage" = 'Nuevo Lead'         WHERE "stage" = 'Nuevo';
UPDATE "leads" SET "stage" = 'Lead respondido'    WHERE "stage" = 'Calificado';
UPDATE "leads" SET "stage" = 'Cita programada'    WHERE "stage" = 'Visita Agendada';
UPDATE "leads" SET "stage" = 'Seguimiento'        WHERE "stage" = 'Visitó Propiedad';
UPDATE "leads" SET "stage" = 'Decisión de compra' WHERE "stage" = 'En Negociación';
UPDATE "leads" SET "stage" = 'Cierre'             WHERE "stage" = 'Cerrado';
