
---------------------------------------------------------
create    proc [STM].SpRptProposalCommission 
(
	@entityId varchar(max)
)
as
begin

DECLARE @UserID                    INT,
        @DateType                  VARCHAR(10),
        @DateFormat                VARCHAR(10),
        @Columns                   AS NVARCHAR(MAX),
        @Query                     AS NVARCHAR(MAX),
        @CustomeFields             AS NVARCHAR(MAX),
        @CustomeFieldSelect        AS NVARCHAR(MAX),
        @Culture                   VARCHAR(10),
		@CultureNo                 Tinyint
	
SET @Culture = CFG.GetuserCulture()
SET @UserID = cfg.GetuserID()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture	

SELECT @DateType = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Type'
       AND us.UserID = @UserID

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                         WHEN 'fa' THEN 0
                         WHEN 'en' THEN 1
                         WHEN 'ar' THEN 2
                    END
	
SELECT @DateFormat = us.SettingValue
FROM   cfg.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @UserID
	       
IF @DateFormat IS NULL
    SET @DATEFORMAT = 'YY/MM/DD'

CREATE TABLE #Ids
(
	id            INT,
	itemOrder     INT
)

INSERT INTO #Ids
SELECT [value],
       Position
FROM   cfg.R_FnCommaStr2Table(@entityId)


select  pc.ProposalCommissionID,
		pc.[Date],
		pc.Number,
		pc.PurchaseplanningID
	into #ProposalCommission
from  vnd.ProposalCommission pc
join #Ids
	on #Ids.id = pc.ProposalCommissionID

select  pc.ProposalCommissionID,
		pc.Date,
		pc.Number,
		pr.PurchaseRequestNumber,
		case when @CultureNo = 1 then pp.PurchaseSubject  else pp.PurchaseSubject2 end PurchaseSubject
	into #PurchasePlanning
from #ProposalCommission pc
join vnd.PurchasePlanning pp 
	on pp.PurchasePlanningID = pc.PurchaseplanningID
join vnd.PurchasePlanningItem ppi 
	on ppi.PurchasePlanningID = pp.PurchasePlanningID
join req.PurchaseRequestItem pri 
	on ppi.PurchaseRequestItemID = pri.PurchaseRequestItemID
join req.PurchaseRequest pr
	on pr.PurchaseRequestID = pri.PurchaseRequestID
group by pc.ProposalCommissionID,
		pc.Date,
		pc.Number,
		pr.PurchaseRequestNumber,
		pp.PurchaseSubject,
		pp.PurchaseSubject2

select  pi.ProposalID,
		pci.ProposalCommissionID,
		pci.Chosen,
		min(pci.Description) Description
	into #item
from vnd.ProposalCommissionItem pci
join VND.ProposalItem pi
	on pi.ProposalItemID = pci.ProposalItemID
join #Ids
	on #Ids.id = pci.ProposalCommissionID
group by pci.ProposalCommissionID,pi.ProposalID,pci.Chosen


select  pp.ProposalCommissionID,
		p.ProposalID,
		p.PartyID,
		i.Chosen,
		p.date,
		i.Description,
		p.TotalPrice-p.TotalDiscount Price
	into #Proposal
from #ProposalCommission pp
join #item i on pp.ProposalCommissionID = i.ProposalCommissionID
join VND.Proposal p
	on p.ProposalID = i.ProposalID

select i.ProposalCommissionID, i.ProposalID,[81] DeliverTerm,[82] PaymentCondition,[83] DeliveryLocation,[84] WarrantyConditions,p.TotalPrice-p.TotalDiscount MinPrice,
case when @CultureNo = 1 then pa.Title + ' ' + ISNULL(pa.LastName,'')  else pa.Title2 + ' ' + ISNULL(pa.LastName2,'') end  MinVendor
into #ChosedVendor
from #item i
join
(
select EntityID,EntityCustomeFieldID,Value 
from cfg.EntityCustomeFieldData
where EntityCustomeFieldID in (81,82,83,84)
)x
pivot
(
max(Value)
for EntityCustomeFieldID in ([81],[82],[83],[84])
)
e on e.EntityID = i.ProposalID
join VND.Proposal p
	on p.ProposalID = i.ProposalID
join cfg.Party pa
	on pa.PartyID = p.PartyID
where i.Chosen = 1


select  pc.ProposalCommissionID,
		case when @CultureNo = 1 then pa.Title + ' ' + ISNULL(pa.LastName,'')  else pa.Title2 + ' ' + ISNULL(pa.LastName2,'') end  Vendor,
		CFG.GetCLRSaturnDate(pc.[Date], @DateFormat, 0,  @DateType) CommissionDate,
		pc.Number CommissionNumber,
		p.ProposalID,
		p.PartyID,
		pp.PurchaseRequestNumber,
		pp.PurchaseSubject,
		p.Chosen,
		CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0,  @DateType) ProposalDate,
		p.Description,
		p.Price,
		v.*
from #Proposal p
join #ProposalCommission pc on pc.ProposalCommissionID = p.ProposalCommissionID
join #PurchasePlanning pp on pc.ProposalCommissionID = pp.ProposalCommissionID
join cfg.Party pa
	on pa.PartyID = p.PartyID
join #ChosedVendor v on v.ProposalCommissionID = pc.ProposalCommissionID
end
