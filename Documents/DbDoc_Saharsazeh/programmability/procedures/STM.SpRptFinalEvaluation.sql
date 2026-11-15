
------------------------------------- END #6943

----------------------------------------- START RAScript19
create   proc [STM].SpRptFinalEvaluation 
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

select  fe.Number,
		fe.Date,
		ppi.Creator Applicant,
		case when @CultureNo = 1 then pp.PurchaseSubject else pp.PurchaseSubject2 end PurchaseSubject,
		fei.PartyID,
		fei.IsConfirm,
		case when @CultureNo = 1 then fei.Description else fei.Description2 end Description,
		fe.MeetingMinutes,
		pp.PurchaseExpertUserID,
		ppi.OrganizationUnitID,
		fe.FinalEvaluationID
	into #Temp
from vnd.FinalEvaluation fe
join #Ids on #Ids.id = fe.FinalEvaluationID
join vnd.PurchasePlanning pp on pp.PurchasePlanningID = fe.PurchasePlanningID
join
(
select ppi.PurchasePlanningID,sr.Creator,sr.OrganizationUnitID
from vnd.PurchasePlanningitem ppi
join req.PurchaseRequestItem pri on ppi.PurchaseRequestItemID = pri.PurchaseRequestItemID
left join req.StuffRequestItem sri on sri.StuffRequestItemID = pri.StuffRequestItemID
left join req.StuffRequest sr on sr.StuffRequestID = sri.StuffRequestID
group by ppi.PurchasePlanningID,sr.Creator,sr.OrganizationUnitID
)ppi on ppi.PurchasePlanningID = pp.PurchasePlanningID
join vnd.FinalEvaluationItem fei on fe.FinalEvaluationID = fei.FinalEvaluationID

select  t.Number,
		cfg.GetCLRSaturnDate(t.Date,@DateFormat,0,@DateType) EvaluationDate,
		t.PurchaseSubject,
		t.IsConfirm,
		t.Description,
		t.MeetingMinutes,
		case when @CultureNo = 1 then u.Name else u.Name2 end ApplicantName,
		case when @CultureNo = 1 then p.Title+isnull(' '+LastName,'') else p.Title2+isnull(' '+LastName2,'') end VendorName,
		case when @CultureNo = 1 then ou.Title else ou.Title2 end  OrganizationUnit,
		case when @CultureNo = 1 then u2.Name else u2.Name2 end PurchaseExpert,
		t.FinalEvaluationID
from #Temp t
left join cfg.[user] u on u.UserID = T.Applicant
join cfg.Party p on p.PartyID = T.PartyID
left join cfg.OrganizationUnit ou on ou.OrganizationUnitID = t.OrganizationUnitID
join cfg.[user] u2 on u2.UserID = T.PurchaseExpertUserID
end
