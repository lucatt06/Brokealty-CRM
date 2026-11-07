import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type QuotePdfData = {
  quoteNumber: string;
  workspaceName: string;
  createdByName: string;
  leadName: string;
  leadPhone: string;
  vehicle: { make: string; model: string; year: number; trim: string | null };
  offeredPrice: number;
  currency: string;
  paymentMethod: string | null;
  downPayment: number | null;
  installments: number | null;
  conditionsText: string | null;
  validUntil: Date;
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
  priceBox: { backgroundColor: "#EFF6FF", borderRadius: 6, padding: 12, marginBottom: 14 },
  priceLabel: { fontSize: 9, color: "#6B7280" },
  priceValue: { fontSize: 20, fontWeight: 700, color: "#2563EB", marginTop: 2 },
  conditions: { marginTop: 4, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9CA3AF", textAlign: "center" },
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" }).format(date);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CONTADO: "Contado",
  FINANCIAMIENTO_BANCARIO: "Financiamiento bancario",
  MIXTO: "Mixto",
  OTRO: "Otro",
};

function QuoteDocument({ data }: { data: QuotePdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.workspaceName}>{data.workspaceName}</Text>
          <Text style={styles.title}>Cotización</Text>
          <Text style={styles.subtitle}>{data.quoteNumber} · {formatDate(data.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre</Text>
            <Text style={styles.value}>{data.leadName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Teléfono</Text>
            <Text style={styles.value}>{data.leadPhone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehículo</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Unidad</Text>
            <Text style={styles.value}>{data.vehicle.make} {data.vehicle.model} {data.vehicle.year}{data.vehicle.trim ? ` ${data.vehicle.trim}` : ""}</Text>
          </View>
        </View>

        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Precio ofrecido</Text>
          <Text style={styles.priceValue}>{formatMoney(data.offeredPrice, data.currency)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condiciones</Text>
          {data.paymentMethod && (
            <View style={styles.row}>
              <Text style={styles.label}>Forma de pago</Text>
              <Text style={styles.value}>{PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod}</Text>
            </View>
          )}
          {data.downPayment != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Inicial</Text>
              <Text style={styles.value}>{formatMoney(data.downPayment, data.currency)}</Text>
            </View>
          )}
          {data.installments != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Cuotas</Text>
              <Text style={styles.value}>{data.installments}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Válida hasta</Text>
            <Text style={styles.value}>{formatDate(data.validUntil)}</Text>
          </View>
          {data.conditionsText && <Text style={styles.conditions}>{data.conditionsText}</Text>}
        </View>

        <Text style={styles.footer} fixed>
          Cotización generada por {data.createdByName} vía Brokealty CRM — no constituye factura ni comprobante fiscal.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument data={data} />);
}
