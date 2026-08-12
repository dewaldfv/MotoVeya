import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ADMIN_EMAIL = "Dewald.motoveya@gmail.com";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const entityName = body.entity_name;
    const entityId = body.entity_id;

    if (!entityName || !entityId) {
      return Response.json({ error: "entity_name and entity_id required" }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities[entityName].get(entityId);
    if (!record) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    let subject, summary;
    if (entityName === "Event") {
      subject = `New Event Submission: ${record.title || "Untitled"}`;
      summary = [
        `Title: ${record.title || "-"}`,
        `Venue: ${record.venue_name || "-"}`,
        `Date: ${record.event_date || "-"}`,
        `Category: ${record.category || "-"}`,
        `Entry Fee: ${record.entry_fee_zar != null ? "R" + record.entry_fee_zar : "-"}`,
        `Contact: ${record.contact_phone || record.contact_email || "-"}`,
        `Description: ${record.description || "-"}`,
      ].join("\n");
    } else if (entityName === "Service") {
      subject = `New Service Provider Submission: ${record.name || "Untitled"}`;
      summary = [
        `Name: ${record.name || "-"}`,
        `Category: ${record.category || "-"}`,
        `Address: ${record.address || "-"}`,
        `Town: ${record.town || "-"}`,
        `Province: ${record.province || "-"}`,
        `Phone: ${record.phone || "-"}`,
        `Email: ${record.email || "-"}`,
        `Website: ${record.website || "-"}`,
        `Description: ${record.description || "-"}`,
      ].join("\n");
    } else {
      subject = `New ${entityName} Submission`;
      summary = JSON.stringify(record, null, 2);
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      subject,
      body: `A new ${entityName.toLowerCase()} has been submitted and is pending review.\n\n${summary}\n\nReview it in the MotoGo Admin dashboard.`
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}