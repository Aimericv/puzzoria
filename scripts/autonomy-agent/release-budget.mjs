// Reserve before allocation; reconcile only against completed GitHub job metadata.
// This allowance is independent of the account's shared free Actions quota.
export const BILLING_MARGIN_MINUTES=2;
export function validationReservation(kind,maximumMinutes) {
  if(!Number.isSafeInteger(maximumMinutes)||maximumMinutes<1||maximumMinutes>90)throw Error('Invalid validator timeout');
  return (kind==='documentation'?5:maximumMinutes)+BILLING_MARGIN_MINUTES;
}
export async function reconcileValidationReservations(api,history,now=Date.now()) {
  const rows=(history??[]).filter(row=>!Number.isFinite(Date.parse(row.at))||now-Date.parse(row.at)<7*86400000);
  for(const row of rows) {
    if(row.settled||!/^\d+$/.test(String(row.runId))||!Number.isSafeInteger(row.minutes)||row.minutes<0)continue;
    try {
      const run=await api(`/actions/runs/${row.runId}`);
      if(run.status!=='completed'||run.repository?.full_name!=='Aimericv/puzzoria'||run.head_branch!=='main'||run.path!=='.github/workflows/autonomy-agent.yml'||run.run_attempt!==(row.attempt??1))continue;
      const {jobs}=await api(`/actions/runs/${row.runId}/jobs?per_page=100`);
      const selected=jobs.filter(job=>job.name==='release-validation');
      if(jobs.length>=100||selected.length!==1)continue;
      const job=selected[0],start=Date.parse(job.started_at),end=Date.parse(job.completed_at);
      if(job.run_id!==Number(row.runId)||job.status!=='completed'||!['success','failure','cancelled','timed_out'].includes(job.conclusion)||!Number.isFinite(start)||!Number.isFinite(end)||end<start||end>now||end-start>95*60000)continue;
      row.reservedMinutes=row.minutes;row.minutes=Math.ceil((end-start)/60000)+BILLING_MARGIN_MINUTES;
      row.settled=true;row.accounting={source:'github-completed-job-timestamps',jobId:job.id,attempt:run.run_attempt,startedAt:job.started_at,completedAt:job.completed_at,marginMinutes:BILLING_MARGIN_MINUTES};
    }catch{/* Unknown or unavailable accounting retains the entire reservation. */}
  }
  return rows;
}
export function validationBudgetAvailable(history,reservation,limit) {
  return Number.isSafeInteger(reservation)&&reservation>0&&Number.isSafeInteger(limit)&&limit>0&&history.every(r=>Number.isSafeInteger(r.minutes)&&r.minutes>=0)&&history.reduce((sum,r)=>sum+r.minutes,0)+reservation<=limit;
}
