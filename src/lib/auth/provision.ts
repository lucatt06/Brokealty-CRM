import { prisma } from "@/lib/prisma";

const DEFAULT_STAGES = [
  { name: "Nuevo", order: 0, color: "#3b82f6", probability: 10 },
  { name: "Contactado", order: 1, color: "#8b5cf6", probability: 25 },
  { name: "Calificado", order: 2, color: "#f59e0b", probability: 40 },
  { name: "Visita Agendada", order: 3, color: "#f97316", probability: 60 },
  { name: "Visitó Propiedad", order: 4, color: "#ec4899", probability: 75 },
  { name: "En Negociación", order: 5, color: "#ef4444", probability: 85 },
];

const DIACRITICS_RANGE_START = 0x0300;
const DIACRITICS_RANGE_END = 0x036f;

function stripDiacritics(text: string) {
  return text
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < DIACRITICS_RANGE_START || code > DIACRITICS_RANGE_END;
    })
    .join("");
}

function slugify(name: string) {
  return stripDiacritics(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "inmobiliaria";
  let slug = root;
  let i = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    i++;
    slug = `${root}-${i}`;
  }
  return slug;
}

/**
 * Registro de un usuario nuevo: crea su propio tenant con defaults.
 * El primer usuario del sistema arranca como Super Admin (cross-workspace).
 */
export async function createUserWithWorkspace(params: { email: string; name: string; passwordHash: string }) {
  const isFirstUser = (await prisma.user.count()) === 0;
  const workspaceName = isFirstUser ? "Mi Inmobiliaria" : `Workspace de ${params.name}`;
  const slug = await uniqueSlug(workspaceName);

  return prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      passwordHash: params.passwordHash,
      workspaces: {
        create: {
          role: isFirstUser ? "SUPER_ADMIN" : "ADMIN",
          workspace: {
            create: {
              name: workspaceName,
              slug,
              currency: "DOP",
              timezone: "America/Santo_Domingo",
              plan: "STARTER",
              pipelines: {
                create: { name: "Pipeline Principal", isDefault: true, order: 0, stages: { create: DEFAULT_STAGES } },
              },
            },
          },
        },
      },
    },
  });
}
