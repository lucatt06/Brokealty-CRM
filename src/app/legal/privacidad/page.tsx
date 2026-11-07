import type { Metadata } from "next";
import { H1, Updated, H2, P, Ul } from "@/components/legal/legal-blocks";

export const metadata: Metadata = { title: "Política de Privacidad — Brokealty CRM" };

export default function PrivacyPolicyPage() {
  return (
    <>
      <H1>Política de Privacidad</H1>
      <Updated>Última actualización: 20 de julio de 2026</Updated>

      <P>
        Brokealty CRM (&quot;Brokealty CRM&quot;, &quot;nosotros&quot;) es una plataforma SaaS de CRM para concesionarios de vehículos
        (&quot;Dealers&quot;, &quot;Clientes&quot;) que permite gestionar leads, inventario, conversaciones con compradores y
        automatizaciones asistidas por inteligencia artificial. Cada Dealer que usa Brokealty CRM administra su
        propia cuenta (&quot;workspace&quot;) de forma independiente y aislada de los demás.
      </P>
      <P>
        Esta política explica qué datos procesa Brokealty CRM, con qué fin, y qué derechos tienen las personas
        cuyos datos pasan por la plataforma — tanto los usuarios de un Dealer (vendedores, administradores)
        como los clientes finales del Dealer (leads/compradores) que le escriben por WhatsApp, Facebook
        Messenger o Instagram.
      </P>

      <H2>1. Qué datos recopilamos</H2>
      <Ul>
        <li><strong>Datos de cuenta:</strong> nombre, correo, teléfono de los usuarios del Dealer (vendedores, administradores).</li>
        <li><strong>Datos de leads/clientes del Dealer:</strong> nombre, teléfono, correo, y el contenido de sus conversaciones (texto, imágenes, notas de voz, documentos) enviadas por WhatsApp, Facebook Messenger, Instagram u otros canales conectados por el Dealer.</li>
        <li><strong>Datos de negocio del Dealer:</strong> inventario de vehículos, negocios (deals), cotizaciones, órdenes de venta, comisiones y demás información operativa que el Dealer ingresa a la plataforma.</li>
        <li><strong>Datos técnicos:</strong> registros de uso de la plataforma, dirección IP y metadatos de dispositivo, con fines de seguridad y soporte.</li>
      </Ul>

      <H2>2. Para qué usamos estos datos</H2>
      <Ul>
        <li>Prestar el servicio de CRM: gestionar leads, inventario, conversaciones y automatizaciones del Dealer.</li>
        <li>Permitir que los Agentes de IA de Brokealty CRM respondan mensajes de clientes en nombre del Dealer, cuando este activa esa función.</li>
        <li>Generar reportes, métricas y recordatorios (citas, tareas, seguimientos) para el Dealer.</li>
        <li>Seguridad, prevención de abuso y cumplimiento de obligaciones legales.</li>
      </Ul>
      <P>
        Brokealty CRM no vende datos personales a terceros, ni los usa para publicidad ajena a la plataforma.
      </P>

      <H2>3. Con quién se comparten los datos (subprocesadores)</H2>
      <P>Para prestar el servicio, Brokealty CRM se apoya en proveedores externos, cada uno procesando solo lo necesario para su función:</P>
      <Ul>
        <li><strong>Meta Platforms</strong> (WhatsApp Business Platform, Facebook Messenger, Instagram) — para enviar y recibir mensajes de los canales que el Dealer conecta.</li>
        <li><strong>Anthropic</strong> (Claude) y <strong>OpenAI</strong> — para generar respuestas de los Agentes de IA y transcribir notas de voz.</li>
        <li><strong>Twilio</strong> — envío y recepción de SMS.</li>
        <li><strong>Resend</strong> — envío de correos transaccionales.</li>
        <li><strong>Google</strong> (Calendar) — sincronización de citas, cuando el Dealer lo conecta.</li>
        <li><strong>Supabase</strong> y <strong>Vercel</strong> — alojamiento de la base de datos y de la aplicación.</li>
      </Ul>
      <P>
        <strong>Sobre los datos de Meta específicamente:</strong> Brokealty CRM únicamente usa los datos obtenidos a través
        de la Plataforma de Meta (WhatsApp, Messenger, Instagram) para prestar el servicio de CRM al Dealer que
        autorizó la conexión. No vendemos, transferimos ni compartimos esos datos con terceros no autorizados,
        y no los usamos con fines distintos a los que el Dealer y el usuario final esperarían de una herramienta
        de mensajería para su negocio.
      </P>

      <H2>4. Retención de datos</H2>
      <P>
        Los datos se conservan mientras el Dealer mantenga su cuenta activa en Brokealty CRM. Si un Dealer cierra su
        cuenta, sus datos se eliminan o anonimizan dentro de un plazo razonable, salvo que la ley exija
        conservarlos por más tiempo (por ejemplo, registros contables).
      </P>

      <H2>5. Seguridad</H2>
      <P>
        Cada Dealer opera en un espacio aislado (&quot;multi-tenant&quot;): los datos de un Dealer nunca son visibles
        para otro. El acceso a la base de datos está protegido con controles de autenticación y reglas de
        seguridad a nivel de fila (RLS).
      </P>

      <H2>6. Tus derechos</H2>
      <P>
        Puedes solicitar acceso, corrección o eliminación de tus datos personales. Si eres cliente final de un
        Dealer (le escribiste por WhatsApp/Messenger/Instagram), puedes pedirle directamente al Dealer que
        elimine tu información, o escribirnos a nosotros y lo canalizamos. Ver la página de{" "}
        <a href="/legal/eliminar-datos" className="text-primary hover:underline">Eliminación de datos</a> para el
        proceso detallado.
      </P>

      <H2>7. Cambios a esta política</H2>
      <P>
        Podemos actualizar esta política ocasionalmente. Los cambios relevantes se notificarán a los Dealers
        por los canales habituales de la plataforma.
      </P>

      <H2>8. Contacto</H2>
      <P>
        Para cualquier consulta sobre privacidad, escríbenos a{" "}
        <a href="mailto:support@canopyitservices.com" className="text-primary hover:underline">support@canopyitservices.com</a>.
      </P>
    </>
  );
}
