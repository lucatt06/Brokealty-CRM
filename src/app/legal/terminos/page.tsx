import type { Metadata } from "next";
import { H1, Updated, H2, P, Ul } from "@/components/legal/legal-blocks";

export const metadata: Metadata = { title: "Términos de Servicio — Brokealty CRM" };

export default function TermsPage() {
  return (
    <>
      <H1>Términos de Servicio</H1>
      <Updated>Última actualización: 20 de julio de 2026</Updated>

      <P>
        Estos Términos rigen el uso de Brokealty CRM, una plataforma SaaS de CRM para concesionarios de vehículos.
        Al crear una cuenta o usar la plataforma, el Dealer y sus usuarios aceptan estos Términos.
      </P>

      <H2>1. El servicio</H2>
      <P>
        Brokealty CRM ofrece gestión de leads, inventario, conversaciones multicanal (WhatsApp, Facebook Messenger,
        Instagram y otros), automatizaciones, y agentes de inteligencia artificial que pueden responder a
        clientes en nombre del Dealer cuando este los activa.
      </P>

      <H2>2. Cuentas y responsabilidad del Dealer</H2>
      <Ul>
        <li>Cada Dealer es responsable de la exactitud de la información que ingresa y de administrar los permisos de sus propios usuarios (vendedores, administradores).</li>
        <li>El Dealer es responsable de contar con el consentimiento necesario de sus clientes para contactarlos por los canales que conecte, y de cumplir la normativa aplicable a su negocio (incluyendo protección de datos y prevención de lavado de activos, según corresponda).</li>
        <li>El Dealer es responsable del contenido enviado por sus Agentes de IA cuando estos operan en modo automático.</li>
      </Ul>

      <H2>3. Canales de mensajería conectados (WhatsApp, Messenger, Instagram)</H2>
      <P>
        Cuando un Dealer conecta un canal de mensajería, autoriza a Brokealty CRM a enviar y recibir mensajes en su
        nombre a través de ese canal, únicamente para prestar el servicio de CRM. El uso de estos canales
        también está sujeto a las políticas de la plataforma correspondiente (Meta Platform Terms, WhatsApp
        Business Terms).
      </P>

      <H2>4. Multi-tenancy y aislamiento de datos</H2>
      <P>
        Los datos de cada Dealer están aislados de los demás. Brokealty CRM no comparte datos de un Dealer con
        otro, ni los usa para fines ajenos a la prestación del servicio a ese Dealer.
      </P>

      <H2>5. Disponibilidad</H2>
      <P>
        Brokealty CRM se esfuerza por mantener el servicio disponible de forma continua, pero no garantiza
        disponibilidad ininterrumpida. Pueden ocurrir mantenimientos o interrupciones ocasionales.
      </P>

      <H2>6. Cambios al servicio y a estos Términos</H2>
      <P>
        Podemos actualizar la plataforma y estos Términos con el tiempo. Los cambios relevantes se
        comunicarán a los Dealers por los canales habituales.
      </P>

      <H2>7. Contacto</H2>
      <P>
        Para consultas sobre estos Términos, escríbenos a{" "}
        <a href="mailto:support@canopyitservices.com" className="text-primary hover:underline">support@canopyitservices.com</a>.
      </P>
    </>
  );
}
