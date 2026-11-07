-- Dominio inmobiliario: Vehicle → Property, sin Conduces, nuevos roles/tipos de cita/trámites.
-- Las tablas de vehículos/conduces no tenían datos de producción; roles y etapas existentes se conservan.
-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'ALQUILADO', 'EN_PREPARACION', 'FUERA_DE_CATALOGO');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTAMENTO', 'CASA', 'VILLA', 'PENTHOUSE', 'TERRENO', 'LOCAL_COMERCIAL', 'OFICINA', 'NAVE_INDUSTRIAL', 'PROYECTO', 'OTRO');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('VENTA', 'ALQUILER', 'VENTA_ALQUILER');

-- AlterEnum
BEGIN;
CREATE TYPE "ActivityType_new" AS ENUM ('LEAD_CREATED', 'LEAD_UPDATED', 'STAGE_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'CALL_MADE', 'APPOINTMENT_CREATED', 'APPOINTMENT_COMPLETED', 'PROPERTY_VIEWED', 'DEAL_WON', 'DEAL_LOST', 'TASK_COMPLETED', 'NOTE_ADDED', 'AI_ACTION', 'MATCH_INVERSO', 'CONDUCE_SALIDA', 'CONDUCE_ENTRADA', 'CONDUCE_VENCIDO', 'QUOTE_ENVIADA', 'QUOTE_ACEPTADA', 'SALES_ORDER_CREATED', 'SALES_ORDER_COMPLETED', 'DDC_APROBADO', 'DDC_RECHAZADO', 'AUTHORIZATION_REQUESTED', 'AUTHORIZATION_DECIDED', 'CONTRACT_GENERADO', 'CONTRACT_FIRMADO', 'PROCEDURE_COMPLETADO');
ALTER TABLE "activities" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "ActivityType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentType_new" AS ENUM ('VISITA_PROPIEDAD', 'LLAMADA', 'VIDEO_LLAMADA', 'FIRMA_CONTRATO', 'ENTREGA_LLAVES', 'SEGUIMIENTO');
ALTER TABLE "appointments" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "appointments" ALTER COLUMN "type" TYPE "AppointmentType_new" USING ("type"::text::"AppointmentType_new");
ALTER TYPE "AppointmentType" RENAME TO "AppointmentType_old";
ALTER TYPE "AppointmentType_new" RENAME TO "AppointmentType";
DROP TYPE "AppointmentType_old";
ALTER TABLE "appointments" ALTER COLUMN "type" SET DEFAULT 'VISITA_PROPIEDAD';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AutomationTrigger_new" AS ENUM ('LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'MESSAGE_RECEIVED', 'APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER', 'PROPERTY_SOLD', 'TASK_DUE', 'INACTIVITY', 'CUSTOM');
ALTER TABLE "automations" ALTER COLUMN "trigger" TYPE "AutomationTrigger_new" USING ("trigger"::text::"AutomationTrigger_new");
ALTER TYPE "AutomationTrigger" RENAME TO "AutomationTrigger_old";
ALTER TYPE "AutomationTrigger_new" RENAME TO "AutomationTrigger";
DROP TYPE "AutomationTrigger_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CommissionCalcType_new" AS ENUM ('PERCENT_OF_VALUE', 'FIXED_AMOUNT');
ALTER TABLE "commission_rules" ALTER COLUMN "calcType" DROP DEFAULT;
ALTER TABLE "commission_rules" ALTER COLUMN "calcType" TYPE "CommissionCalcType_new" USING ("calcType"::text::"CommissionCalcType_new");
ALTER TYPE "CommissionCalcType" RENAME TO "CommissionCalcType_old";
ALTER TYPE "CommissionCalcType_new" RENAME TO "CommissionCalcType";
DROP TYPE "CommissionCalcType_old";
ALTER TABLE "commission_rules" ALTER COLUMN "calcType" SET DEFAULT 'PERCENT_OF_VALUE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OperationDocumentType_new" AS ENUM ('CEDULA', 'PASAPORTE', 'CONTRATO', 'COMPROBANTE_PAGO', 'DDC_SOPORTE', 'TITULO_PROPIEDAD', 'CERTIFICACION_TITULO', 'OTRO');
ALTER TABLE "operation_documents" ALTER COLUMN "type" TYPE "OperationDocumentType_new" USING ("type"::text::"OperationDocumentType_new");
ALTER TYPE "OperationDocumentType" RENAME TO "OperationDocumentType_old";
ALTER TYPE "OperationDocumentType_new" RENAME TO "OperationDocumentType";
DROP TYPE "OperationDocumentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProcedureType_new" AS ENUM ('LEGALIZACION_CONTRATO', 'CERTIFICACION_ESTATUS_JURIDICO', 'IMPUESTO_TRANSFERENCIA', 'TRANSFERENCIA_TITULO', 'ENTREGA_LLAVES', 'OTRO');
ALTER TABLE "workspaces" ALTER COLUMN "requiredPostSaleProcedures" DROP DEFAULT;
ALTER TABLE "workspaces" ALTER COLUMN "requiredPostSaleProcedures" TYPE "ProcedureType_new"[] USING ("requiredPostSaleProcedures"::text::"ProcedureType_new"[]);
ALTER TABLE "post_sale_procedures" ALTER COLUMN "type" TYPE "ProcedureType_new" USING ("type"::text::"ProcedureType_new");
ALTER TYPE "ProcedureType" RENAME TO "ProcedureType_old";
ALTER TYPE "ProcedureType_new" RENAME TO "ProcedureType";
DROP TYPE "ProcedureType_old";
ALTER TABLE "workspaces" ALTER COLUMN "requiredPostSaleProcedures" SET DEFAULT ARRAY[]::"ProcedureType"[];
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENTE');
ALTER TABLE "authorization_rules" ALTER COLUMN "requiredApproverRole" DROP DEFAULT;
ALTER TABLE "workspace_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "workspace_users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "authorization_rules" ALTER COLUMN "requiredApproverRole" TYPE "Role_new" USING ("requiredApproverRole"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "authorization_rules" ALTER COLUMN "requiredApproverRole" SET DEFAULT 'ADMIN';
ALTER TABLE "workspace_users" ALTER COLUMN "role" SET DEFAULT 'AGENTE';
COMMIT;

-- DropForeignKey
ALTER TABLE "_VehicleTags" DROP CONSTRAINT "_VehicleTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_VehicleTags" DROP CONSTRAINT "_VehicleTags_B_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "conduces" DROP CONSTRAINT "conduces_authorizedById_fkey";

-- DropForeignKey
ALTER TABLE "conduces" DROP CONSTRAINT "conduces_leadId_fkey";

-- DropForeignKey
ALTER TABLE "conduces" DROP CONSTRAINT "conduces_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "conduces" DROP CONSTRAINT "conduces_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_interestedVehicleId_fkey";

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "sales_orders" DROP CONSTRAINT "sales_orders_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "vehicle_photos" DROP CONSTRAINT "vehicle_photos_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "vehicle_price_history" DROP CONSTRAINT "vehicle_price_history_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_soldByUserId_fkey";

-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_soldToLeadId_fkey";

-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_workspaceId_fkey";

-- DropIndex
DROP INDEX "activities_vehicleId_createdAt_idx";

-- DropIndex
DROP INDEX "sales_orders_vehicleId_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "vehicleId",
ADD COLUMN     "propertyId" TEXT;

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "type" SET DEFAULT 'VISITA_PROPIEDAD';

-- AlterTable
ALTER TABLE "authorization_rules" ALTER COLUMN "requiredApproverRole" SET DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "deals" DROP COLUMN "vehicleId",
ADD COLUMN     "propertyId" TEXT;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "desiredColor",
DROP COLUMN "desiredMake",
DROP COLUMN "desiredModel",
DROP COLUMN "desiredYear",
DROP COLUMN "interestedVehicleId",
ADD COLUMN     "desiredBedrooms" INTEGER,
ADD COLUMN     "desiredCity" TEXT,
ADD COLUMN     "desiredListingType" "ListingType",
ADD COLUMN     "desiredPropertyType" "PropertyType",
ADD COLUMN     "desiredSector" TEXT,
ADD COLUMN     "interestedPropertyId" TEXT;

-- AlterTable
ALTER TABLE "post_sale_procedures" DROP COLUMN "vehicleId",
ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quotes" DROP COLUMN "vehicleId",
ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sales_orders" DROP COLUMN "vehicleId",
ADD COLUMN     "propertyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "website_configs" DROP COLUMN "featuredVehicleIds",
ADD COLUMN     "featuredPropertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "workspace_users" ALTER COLUMN "role" SET DEFAULT 'AGENTE';

-- DropTable
DROP TABLE "_VehicleTags";

-- DropTable
DROP TABLE "conduces";

-- DropTable
DROP TABLE "vehicle_photos";

-- DropTable
DROP TABLE "vehicle_price_history";

-- DropTable
DROP TABLE "vehicles";

-- DropEnum
DROP TYPE "BodyType";

-- DropEnum
DROP TYPE "ConduceReason";

-- DropEnum
DROP TYPE "ConduceStatus";

-- DropEnum
DROP TYPE "ConduceType";

-- DropEnum
DROP TYPE "FuelType";

-- DropEnum
DROP TYPE "Transmission";

-- DropEnum
DROP TYPE "VehicleStatus";

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sku" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "propertyType" "PropertyType" NOT NULL DEFAULT 'APARTAMENTO',
    "listingType" "ListingType" NOT NULL DEFAULT 'VENTA',
    "title" TEXT NOT NULL,
    "projectName" TEXT,
    "province" TEXT,
    "city" TEXT,
    "sector" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "parkingSpaces" INTEGER,
    "constructionM2" DOUBLE PRECISION,
    "landM2" DOUBLE PRECISION,
    "floorNumber" INTEGER,
    "yearBuilt" INTEGER,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "priceDOP" DOUBLE PRECISION,
    "priceUSD" DOUBLE PRECISION,
    "maintenanceDOP" DOUBLE PRECISION,
    "minimumPrice" DOUBLE PRECISION,
    "commissionPct" DOUBLE PRECISION,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "capturedById" TEXT,
    "videoUrl" TEXT,
    "virtualTourUrl" TEXT,
    "daysListed" INTEGER NOT NULL DEFAULT 0,
    "listedAt" TIMESTAMP(3),
    "soldDate" TIMESTAMP(3),
    "soldToLeadId" TEXT,
    "soldByUserId" TEXT,
    "description" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_price_history" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "priceDOP" DOUBLE PRECISION,
    "priceUSD" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PropertyTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "properties_workspaceId_status_idx" ON "properties"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "properties_workspaceId_listingType_propertyType_idx" ON "properties"("workspaceId", "listingType", "propertyType");

-- CreateIndex
CREATE INDEX "properties_workspaceId_city_sector_idx" ON "properties"("workspaceId", "city", "sector");

-- CreateIndex
CREATE UNIQUE INDEX "properties_workspaceId_sku_key" ON "properties"("workspaceId", "sku");

-- CreateIndex
CREATE INDEX "property_price_history_propertyId_createdAt_idx" ON "property_price_history"("propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_PropertyTags_AB_unique" ON "_PropertyTags"("A", "B");

-- CreateIndex
CREATE INDEX "_PropertyTags_B_index" ON "_PropertyTags"("B");

-- CreateIndex
CREATE INDEX "activities_propertyId_createdAt_idx" ON "activities"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orders_propertyId_idx" ON "sales_orders"("propertyId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_soldToLeadId_fkey" FOREIGN KEY ("soldToLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_price_history" ADD CONSTRAINT "property_price_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_interestedPropertyId_fkey" FOREIGN KEY ("interestedPropertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyTags" ADD CONSTRAINT "_PropertyTags_A_fkey" FOREIGN KEY ("A") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyTags" ADD CONSTRAINT "_PropertyTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Datos existentes: etapas del pipeline creadas antes del cambio de dominio.
UPDATE "pipeline_stages" SET "name" = 'Visita Agendada' WHERE "name" = 'Cita Agendada';
UPDATE "pipeline_stages" SET "name" = 'Visitó Propiedad' WHERE "name" = 'Visitó Dealer';
UPDATE "leads" SET "stage" = 'Visita Agendada' WHERE "stage" = 'Cita Agendada';
UPDATE "leads" SET "stage" = 'Visitó Propiedad' WHERE "stage" = 'Visitó Dealer';
