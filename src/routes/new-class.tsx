import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClassroom } from "@/domain/classroom/classroom";
import { ClassForm, type ClassFormValues } from "@/features/classes/class-form";
import { classKeys } from "@/features/classes/class-queries";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { PageHeader } from "@/shared/components/page-header";

export function NewClassPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function create(values: ClassFormValues) {
    const classroom = createClassroom(values);
    await classkitRepository.createClass(classroom);
    await queryClient.invalidateQueries({ queryKey: classKeys.all });
    await navigate({
      to: "/classes/$classId",
      params: { classId: classroom.id },
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button asChild variant="ghost" className="mb-5 -ml-3">
        <Link to="/classes">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to classes
        </Link>
      </Button>
      <PageHeader
        title="Create a class"
        description="Add the basics now. You can update these details later."
      />
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <ClassForm submitLabel="Create class" onSubmit={create} />
      </section>
    </main>
  );
}
