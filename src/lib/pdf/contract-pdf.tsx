import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type ContractPdfData = {
  workspaceName: string;
  documentType: string;
  renderedBody: string;
  generatedAt: Date;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { marginBottom: 20, borderBottom: "2 solid #2563EB", paddingBottom: 12 },
  workspaceName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  title: { fontSize: 12, color: "#2563EB", fontWeight: 700, textTransform: "uppercase" },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  body: { lineHeight: 1.6, whiteSpace: "pre-wrap" },
  signatures: { flexDirection: "row", marginTop: 60, justifyContent: "space-between" },
  signatureBox: { width: "45%", borderTop: "1 solid #111827", paddingTop: 6, textAlign: "center", fontSize: 9 },
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" }).format(date);
}

function ContractDocument({ data }: { data: ContractPdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.workspaceName}>{data.workspaceName}</Text>
          <Text style={styles.title}>{data.documentType.replace(/_/g, " ")}</Text>
          <Text style={styles.subtitle}>{formatDate(data.generatedAt)}</Text>
        </View>

        <Text style={styles.body}>{data.renderedBody}</Text>

        <View style={styles.signatures}>
          <Text style={styles.signatureBox}>Vendedor</Text>
          <Text style={styles.signatureBox}>Comprador</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderContractPdf(data: ContractPdfData): Promise<Buffer> {
  return renderToBuffer(<ContractDocument data={data} />);
}
