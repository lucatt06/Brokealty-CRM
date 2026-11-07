"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type TaskStatus = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CANCELADA";
type Priority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

export async function createTask(data: {
  workspaceId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  assignedTo?: string | null;
  leadId?: string | null;
  priority?: Priority;
  status?: TaskStatus;
}) {
  await prisma.task.create({
    data: {
      workspaceId: data.workspaceId,
      title: data.title,
      description: data.description || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      assignedTo: data.assignedTo || null,
      leadId: data.leadId || null,
      priority: data.priority ?? "MEDIA",
      status: data.status ?? "PENDIENTE",
    },
  });
  revalidatePath("/tareas");
}

export async function updateTask(id: string, data: {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  assignedTo?: string | null;
  leadId?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  completedAt?: string | null;
}) {
  await prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      ...(data.leadId !== undefined && { leadId: data.leadId }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.completedAt !== undefined && { completedAt: data.completedAt ? new Date(data.completedAt) : null }),
    },
  });
  revalidatePath("/tareas");
}

export async function toggleTaskStatus(id: string, currentStatus: TaskStatus) {
  const next = currentStatus === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA";
  await prisma.task.update({
    where: { id },
    data: {
      status: next,
      completedAt: next === "COMPLETADA" ? new Date() : null,
    },
  });
  revalidatePath("/tareas");
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tareas");
}
