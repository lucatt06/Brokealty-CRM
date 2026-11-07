import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type ConducePdfData = {
  id: string;
  type: "ENTRADA" | "SALIDA";
  reasonLabel: string;
  reasonDetail: string | null;
  workspaceName: string;
  vehicle: { make: string; model: string; year: number; vin: string | null };
  authorizedByName: string;
  driverName: string | null;
  driverDocument: string | null;
  originLocation: string | null;
  destinationLocation: string | null;
  mileageAtMovement: number | null;
  observations: string | null;
  expectedReturnAt: Date | null;
  createdAt: Date;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { marginBottom: 20, borderBottom: "2 solid #2563EB", paddingBottom: 12 },
  workspaceName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  title: { fontSize: 12, color: "#2563EB", fontWeight: 700 },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { width: 140, color: "#6B7280" },
  value: { flex: 1, fontWeight: 500 },
  observations: { marginTop: 4, lineHeight: 1.4 },
  signatures: { flexDirection: "row", marginTop: 50, justifyContent: "space-between" },
  signatureBox: { width: "45%", borderTop: "1 solid #111827", paddingTop: 6, textAlign: "center", fontSize: 9 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9CA3AF", textAlign: "center" },
});

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ConduceDocument({ data }: { data: ConducePdfData }) {
  const typeLabel = data.type === "SALIDA" ? "Salida" : "Entrada";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.workspaceName}>{data.workspaceName}</Text>
          <Text style={styles.title}>Conduce de Vehículo — {typeLabel}</Text>
          <Text style={styles.subtitle}>Folio {data.id} · {formatDate(data.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehículo</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Unidad</Text>
            <Text style={styles.value}>{data.vehicle.make} {data.vehicle.model} {data.vehicle.year}</Text>
          </View>
          {data.vehicle.vin && (
            <View style={styles.row}>
              <Text style={styles.label}>VIN</Text>
              <Text style={styles.value}>{data.vehicle.vin}</Text>
            </View>
          )}
          {data.mileageAtMovement != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Kilometraje</Text>
              <Text style={styles.value}>{data.mileageAtMovement.toLocaleString("es-DO")} km</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movimiento</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Motivo</Text>
            <Text style={styles.value}>{data.reasonLabel}{data.reasonDetail ? ` — ${data.reasonDetail}` : ""}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Autorizado por</Text>
            <Text style={styles.value}>{data.authorizedByName}</Text>
          </View>
          {data.driverName && (
            <View style={styles.row}>
              <Text style={styles.label}>Chofer / responsable</Text>
              <Text style={styles.value}>{data.driverName}{data.driverDocument ? ` — Cédula ${data.driverDocument}` : ""}</Text>
            </View>
          )}
          {data.originLocation && (
            <View style={styles.row}>
              <Text style={styles.label}>Origen</Text>
              <Text style={styles.value}>{data.originLocation}</Text>
            </View>
          )}
          {data.destinationLocation && (
            <View style={styles.row}>
              <Text style={styles.label}>Destino</Text>
              <Text style={styles.value}>{data.destinationLocation}</Text>
            </View>
          )}
          {data.expectedReturnAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Retorno esperado</Text>
              <Text style={styles.value}>{formatDate(data.expectedReturnAt)}</Text>
            </View>
          )}
        </View>

        {data.observations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text style={styles.observations}>{data.observations}</Text>
          </View>
        )}

        <View style={styles.signatures}>
          <Text style={styles.signatureBox}>Autorizado por</Text>
          <Text style={styles.signatureBox}>Recibido por / Chofer</Text>
        </View>

        <Text style={styles.footer} fixed>
          Documento generado por Brokealty CRM — no constituye factura ni comprobante fiscal.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderConducePdf(data: ConducePdfData): Promise<Buffer> {
  return renderToBuffer(<ConduceDocument data={data} />);
}
