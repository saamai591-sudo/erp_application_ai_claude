
CREATE    view cfg.vwReservedStuffs
as

select qno.BranchID,qno.StuffID,sum(qno.Non) Non from sle.Quotation_Non_Outgoing qno
join cfg.Configuration c on c.ConfigKey = 'BaseDocumentForReserve' and c.ConfigValue = 'Quotation'
WHERE qno.[Status]<> 2
and qno.Non>0
group by qno.StuffID ,qno.BranchID
Having sum(qno.Non)<>0
union all


select qno.BranchID,qno.StuffID,sum(qno.Non) Non from sle.Invoice_Non_OutGoing qno
join cfg.Configuration c on c.ConfigKey = 'BaseDocumentForReserve' and c.ConfigValue = 'Invoice'
group by qno.StuffID ,qno.BranchID
Having sum(qno.Non)<>0
union all

select qno.BranchID,qno.StuffID,sum(qno.Non) Non from sle.Remittance_Non_Outgoing qno
join cfg.Configuration c on c.ConfigKey = 'BaseDocumentForReserve' and c.ConfigValue = 'Remittance'
where qno.Status <> 2
group by qno.BranchID,qno.StuffID 
Having sum(qno.Non)<>0
union all

select qno.BranchID,qno.StuffID,sum(qno.Non) Non from sle.SaleContract_Non_Outgoing qno
join cfg.Configuration c on c.ConfigKey = 'BaseDocumentForReserve' and c.ConfigValue = 'SaleContract'
group by qno.BranchID,qno.StuffID 
Having sum(qno.Non)<>0
union all
select qno.BranchID,qno.StuffID,sum(qno.NonOutgoing) Non from req.StuffRequest_Remains qno
join cfg.Configuration c on c.ConfigKey = 'BaseDocumentForConsumeReserve' and c.ConfigValue = 'StuffRequest'
and qno.StuffRequestState <> 3 
and qno.StuffRequestState <> 4
group by qno.BranchID,qno.stuffid
having sum(qno.NonOutgoing) <> 0
