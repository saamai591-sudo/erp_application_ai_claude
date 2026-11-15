-------------------------------------
CREATE   PROC [STM].SpRptQuotation
@ID nvarchar(max)
--WITH ENCRYPTION 
AS

create table ##Ids
(id int)

insert into ##Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

Declare @Columns AS NVARCHAR(MAX),
		@Query  AS NVARCHAR(MAX),
		@CustomeFields  AS NVARCHAR(MAX),
		@UserID INT,
		@DateType  VARCHAR(10),
		@DateFormat VARCHAR(10),
		@Culture varchar(10),
@Param nVARCHAR(max)



			set @Culture = CFG.GetuserCulture()

	SET  @UserID=cfg.GetuserID()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'

select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

if(@Columns is null)								   
set @Columns = '[-1]'

select @CustomeFields =  STUFF((SELECT distinct ',' + QUOTENAME(Fieldname) 
									FROM cfg.EntityCustomeField
									WHERE EntityName = 'Quotation'
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
if(@CustomeFields is null)								   
set @CustomeFields = '[NoCustomeField]' 


set @Query = N'
select 
	qi.QuotationItemID,
	d.title CustomerTitle,
	d.code as DlCode,
	q.Number,
	st1.SaleTypeID,
	st1.title SaleTypeTitle,
	SaleArea.SaleAreaID,
	SaleArea.Title SaleAreaTitle,
	stf.StuffGroupCode,
	STF.StuffGroupFullTitle(stf.StuffGroupID) StuffGroupTitle,
	CFG.GetCLRSaturnDate(q.[Date], '''+@DateFormat+'''  , 0, '''+@DateType+''') [Date],
	CFG.GetCLRSaturnDate(q.[ExpirationDate], '''+@DateFormat+'''  , 0, '''+@DateType+''') [ExpirationDate],
	q.QuotationID,
	q.CurrencyID,
	p.PartyID,
	p.EconomicCode,
	p.NationalID,
	p.IdentificationCode,
	p.registercode RegistrationCode,
	a.*,
	stf.StuffID,
	stf.Code,
	Stf.Irancode,
	Stf.TechnicalCode,
	stf.Title StuffTitle,
	MainMeasureUnitID MeasureUnitID,
	MainMeasureUnit UnitTitle,
	qi.MainQuantity,
	qi.SubQuantity,
	qi.Fee,qi.Price,
	qi.Discount,
	qi.SaleModelID,
	qi.Tax,
	qi.Duty,
	qi.Netprice,
	q.TotalDiscount,
	q.TotalDuty,
	q.TotalNetPrice,
	q.TotalPrice,
	q.TotalTax,
	qi.RowIndex,
	SubMeasureUnit SubUnitTitle,
	qi.Description,
	currency.title CurrencyTitle,
	currency.Code CurrencyCode,
	CustomEntities.*,
	' + @Columns + ',
	Phone.Phone,
	Phone.Fax,
	p.CustomerCode,
	Us.Name,
	branch.Address branchAddress,
	branch.phone branchphone,
	branch.Fax branchFax,
	Phone.Mobile,
	Phone.FixPhone,
	(select address from cfg.address where partyid=q.customerid and ismain=1)  CustomerAddress  ,
	Case when qi.Price=0 then 0
		 Else qi.Discount / qi.Price
		 End DiscountPercent  ,
	p.Type   PartyType,
	branch.Title  BranchTitle,
	CASE   isnull(qi.Description ,'' '' ) when '' ''   THEN  stf.Title
	   else qi.Description
	   END StuffTitle_With_Description  ,
	q.Version
from sle.Quotation q
join cfg.currency on currency.currencyid = q.currencyid
JOIN sle.QuotationItem qi on qi.QuotationID = q.QuotationID
join sle.SaleType st1 on q.SaleTypeID=st1.SaleTypeID
left join sle.SaleArea SaleArea on q.SaleAreaID = SaleArea.SaleAreaID
join CFG.Branch branch on branch.branchID=q.branchID
LEFT JOIN 
 (
select QuotationItemID,TraceID,Case When tr.DLID IS NOT NULL 
THEN cast ((select title from acc.DL u where u.DLID=tr.DlID) as nvarchar(max))
When tr.traceitemid IS NOT NULL 
THEN cast ((select item from stf.traceitem u where u.traceitemid=tr.traceitemid) as nvarchar(max))
else Value end Value
from sle.QuotationItemTrace tr
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.QuotationItemID = qi.QuotationItemID
JOIN stf.vwstuff stf on stf.StuffID = qi.StuffID
JOIN cfg.Party p on p.PartyID = q.CustomerID
LEFT JOIN acc.dl d on d.dlid = p.dlid
JOIN CFG.[User] Us on Us.userId=q.Creator
LEFT JOIN (SELECT  va.AddressID, va.AddressTypeID, va.IsMain, va.TitleAddress,
				   va.TitleAddress2, va.ZipCode, va.country, va.country2, va.province,
				   va.province2, va.county, va.county2, va.city, va.city2, va.PreNumberOfCity,
				   va.ProvinceTaxCode, va.CityTaxCode
			FROM cfg.VwAddress AS va
		  ) a on a.AddressID= q.AddressID
LEFT JOIN 
(
SELECT ecf.EntityID,ecfd.Fieldname,
case when b.LookupDataItemID is not null then b.title
when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], '''+@DateFormat+'''  , 0, '''+@DateType+''') else  
	ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
LEFT JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
left join cfg.LookupDataItem b on ecf.LookupDataItemID = b.LookupDataItemID
WHERE ecfd.EntityName = ''Quotation''
)x
pivot 
(
	 max(Value)
	for Fieldname IN ('+@CustomeFields+')
)  CustomEntities on CustomEntities.EntityID = q.QuotationID
left join cfg.vwphone phone on phone.PartyID = q.CustomerID
where q.QuotationID in (select id from ##Ids)'

EXECUTE sp_executeSQL     
            @Query,
            @Param

	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids

