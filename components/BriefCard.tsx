import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { resolveBriefCompanyName, type NormalizedBriefRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface BriefCardProps {
  brief: NormalizedBriefRecord;
}

export function BriefCard({ brief }: BriefCardProps) {
  const companyName = resolveBriefCompanyName(brief.brief_data, brief.company_name);

  return (
    <Link href={`/brief/${brief.id}`} className="group block">
      <Card className="h-full transition-transform group-hover:-translate-y-1">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="signal-eyebrow">
                {formatDate(brief.created_at)}
              </p>
              <h3 className="signal-title mt-2 text-2xl text-foreground">
                {companyName}
              </h3>
            </div>
            <ArrowUpRight className="h-5 w-5 text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
          </div>

          <Badge variant="secondary" className="w-fit">
            {brief.brief_data.company_overview.industry}
          </Badge>

          <p className="signal-copy text-sm">
            {brief.brief_data.financial_health.summary ||
              brief.brief_data.company_overview.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
