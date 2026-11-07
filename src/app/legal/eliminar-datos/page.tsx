import type { Metadata } from "next";
import { H1, Updated, H2, P, Ul } from "@/components/legal/legal-blocks";

export const metadata: Metadata = { title: "Eliminación de Datos — Brokealty CRM" };

export default function DataDeletionPage() {
  return (
    <>
      <H1>Instrucciones para Eliminar tus Datos</H1>
      <Updated>Última actualización: 20 de julio de 2026</Updated>

      <P>
        Esta página explica cómo pedir la eliminación de tus datos personales de Brokealty CRM, incluyendo los
        datos obtenidos a través de WhatsApp, Facebook Messenger o Instagram cuando le escribes a un negocio
        que usa Brokealty CRM como su CRM.
      </P>

      <H2>Si eres cliente de un Dealer (le escribiste por WhatsApp, Messenger o Instagram)</H2>
      <P>
        El negocio al que le escribiste (el &quot;Dealer&quot;) es quien administra tu información dentro de Brokealty CRM.
        Puedes pedirle la eliminación directamente a él, o escribirnos a nosotros y lo canalizamos con el
        Dealer correspondiente.
      </P>

      <H2>Cómo solicitar la eliminación</H2>
      <P>
        Envía un correo a{" "}
        <a href="mailto:support@canopyitservices.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos" className="text-primary hover:underline">
          support@canopyitservices.com
        </a>{" "}
        con el asunto <strong>&quot;Solicitud de eliminación de datos&quot;</strong>, incluyendo:
      </P>
      <Ul>
        <li>Tu nombre completo.</li>
        <li>El número de teléfono o cuenta (WhatsApp/Facebook/Instagram) desde la que contactaste al Dealer.</li>
        <li>El nombre del Dealer (negocio) con el que interactuaste, si lo recuerdas.</li>
      </Ul>
      <P>
        Verificaremos la solicitud y eliminaremos tus datos personales de nuestros sistemas dentro de un plazo
        de hasta 30 días, salvo que la ley nos exija conservar cierta información (por ejemplo, registros
        contables de una compraventa ya concretada).
      </P>

      <H2>Si eres un Dealer (usuario de la plataforma)</H2>
      <P>
        Si quieres eliminar tu cuenta de Brokealty CRM y todos los datos de tu workspace, escríbenos al mismo
        correo con el asunto <strong>&quot;Cierre de cuenta&quot;</strong>. Ten en cuenta que esto elimina de forma
        permanente tu inventario, leads, conversaciones e historial — te pediremos confirmación explícita
        antes de proceder.
      </P>

      <H2>Contacto</H2>
      <P>
        <a href="mailto:support@canopyitservices.com" className="text-primary hover:underline">support@canopyitservices.com</a>
      </P>
    </>
  );
}
