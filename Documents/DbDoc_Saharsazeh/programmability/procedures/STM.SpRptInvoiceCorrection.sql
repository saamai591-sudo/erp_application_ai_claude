
CREATE   PROC [STM].SpRptInvoiceCorrection
(@ID NVARCHAR(MAX))
--WITH ENCRYPTION 
AS
BEGIN
	CREATE TABLE #Ids
	(
		id            INT,
		itemOrder     INT
	)

	INSERT INTO #Ids
	SELECT [value],
		   Position
	FROM   cfg.R_FnCommaStr2Table(@ID)

	DECLARE @UserID                    INT,
			@DateType                  VARCHAR(10),
			@DateFormat                VARCHAR(10),
			@Columns                   AS NVARCHAR(MAX),
			@SelectColumns                   AS NVARCHAR(MAX),
			@Query                     AS NVARCHAR(MAX),
			@CustomeFields             AS NVARCHAR(MAX),
			@CustomeFieldSelect        AS NVARCHAR(MAX),
			@Culture                   VARCHAR(10),
			@CultureNo					INT,
			@IsBranchInstalled BIT,
	@Param nVARCHAR(max)

	SELECT @IsBranchInstalled = li.LicenceValue FROM cfg.LicenceInfo AS li 
	
	SET @Culture = CFG.GetuserCulture()
	SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo 
WHERE Culture = @Culture

	SET @UserID = cfg.GetuserID()

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

	SELECT @Columns = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(TraceID)
               FROM   STF.Trace
                      FOR XML PATH(''),
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

	IF (@Columns IS NULL)
		SET @Columns = '[-1]'

	SELECT @SelectColumns = STUFF(
           (
               SELECT DISTINCT ',piv.' + QUOTENAME(TraceID)
               FROM   STF.Trace
                      FOR XML PATH(''),
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

	IF (@SelectColumns IS NULL)
		SET @SelectColumns = '[-1]'
	
	SELECT @CustomeFields = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(Fieldname)
               FROM   cfg.EntityCustomeField
               WHERE  EntityName = 'invoice'
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )



	SELECT @CustomeFieldSelect = STUFF(
           (
               SELECT DISTINCT ',CustomEntities.' + QUOTENAME(Fieldname) + ' As cf_' + Fieldname
               FROM   cfg.EntityCustomeField
               WHERE  EntityName = 'InvoiceCorrection'
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )


	
	SELECT  *
	into #TaxData
	from cfg.TaxData
	where DocumentName = 'InvoiceCorrection'

	select *
	into #Stuff
	from stf.VWStuff



	select a.*
	into #Address
	from [CFG].[FULLAddressForAllParties]() a
	join 
	(
	select CustomerID
	from sle.InvoiceCorrection b
	join #Ids c on c.id = b.InvoiceCorrectionID
	group by CustomerID
	) b on a.PartyID = b.CustomerID

	SET @Query = N' select 
						case when @CultureNo = 1 then  d.title Else d.Title2 End PartyName,
						q.SaleTypeID,q.SaleAreaID,
						stype.Title SaleTypeTitle,
						smodel.Title SaleModelTitle,
						p.Type PartyType,
						q.Number,
						CFG.GetCLRSaturnDate(q.[Date], @DateFormat  , 0,  @DateType ) [Date],
						q.InvoiceCorrectionID,
						p.EconomicCode,
						p.PartyID,
						STF.StuffGroupCode,
						STF.StuffGroupFullTitle(stf.StuffGroupID) StuffGroupTitle,
						stf.Barcode,
						p.NationalID,
						p.IdentificationCode,
						p.RegisterCode,
						p.FidaCode,
						p.FidaIDCode,
						a.  AddressID, 
						a.  AddressTypeID,
						a.  IsMain,
						case when @CultureNo = 1 then  a.[Address] else a.Address2 End [Address],
						q.date InvoiceCorrectionDate,
						a.  ZipCode,
						a.  partyTitle,
						a.  country,
						a.  province,
						a.  provinceMinistryCode,
						a.  county,
						a.  city,
						a.  cityMinistryCode,
						a.  PreNumber,
						case when @CultureNo = 1 then  a.[Address] else a.Address2 end DeliveryAddress,
						stf.Code,
						stf.Stuffid,
						case when @CultureNo = 1 then  stf.Title else stf.Title2 end StuffTitle,
						case when @CultureNo = 1 then  mu.Title else mu.Title2 End UnitTitle,
						ii.MainQuantity,
						ii.SubQuantity,
						qi.RevisionFee,
						qi.RevisionPrice,
						qi.RevisionDiscount,
						qi.RevisionVat,
						qi.RevisionNetPrice,
						stf.UniqueTaxID StuffUniqueTaxID,
						SubMeasureUnit SubUnitTitle,
						' + @SelectColumns + ',
						Vat.TaxRate,
						stf.TechnicalCode,
						Vat.DutyRate,
						ii.SaleModelID,
						qi.InvoiceCorrectionItemID,
						p.CustomerCode,
						d.code DlCode,
						case when @CultureNo = 1 then  dls.Title else dls.Title2 End AgentName,
						Percentage,
						branch.Address  branchAddress,
						branch.PostalCode BranchPostalCode,
						branch.phone  branchphone,
						branch.Fax branchFax,
						phone.Fax,
						phone.FixPhone,
						phone.Mobile,
						phone.Phone,
						case when @CultureNo = 1 then  us.Name else us.Name2 End CreatorName,
						case when @CultureNo = 1 then  us1.Name else us1.Name2 End LastEditorName,
						case when @CultureNo = 1 then  currency.title Else Currency.Title2 End  Currency,
						Case stf.type when 0 then ''STUFF'' else ''Service'' End StuffType   ,
						 stf.Title	StuffTitle_With_Description ,
						case when @IsBranchInstalled = 1 then  branch.Title else '''' end  BranchTitle,
						cmp.Title CompanyTitle,
						cmp.NationalID CompanyNationalID,
						cmp.RegistrationNumber CompanyRegistrationNumber,
						i.CurrencyRate,
						TaxData.UniqueTaxID,
						stf.IranCode
	from sle.InvoiceCorrection q
	join sle.invoice i on q.ParentInvoiceID = i.InvoiceID
	Inner join #Ids on #ids.Id=q.InvoiceCorrectionID
	left join #TaxData TaxData on TaxData.DocumentID = q.InvoiceCorrectionID
	join cfg.currency on currency.currencyid = i.currencyid
	join sle.InvoiceCorrectionItem qi on q.InvoiceCorrectionID = qi.InvoiceCorrectionID
	join CFG.Branch branch on branch.branchID=q.branchID
	join cfg.Company cmp on branch.CompanyID = cmp.CompanyID
	join sle.InvoiceItem ii on qi.InvoiceItemID = ii.InvoiceItemID	
	join sle.SaleModel smodel on ii.SaleModelId = smodel.SaleModelID
	left join 
	(
	  select InvoiceItemID,TraceID,Case When t.DLID IS NOT NULL 
	  THEN cast ((select title from acc.DL d where d.DLID=t.DlID ) as nvarchar(max)) 
	  when t.traceitemid is not null then cast ((select item from stf.traceitem g where g.traceitemid=t.traceitemid ) as nvarchar(max))   else Value end Value
	  from SLE.InvoiceItemTrace t
	  ) x
	pivot 
	(
		 max(Value)
		for TraceID in ( ' + @Columns + ')
	)  piv on piv.InvoiceItemID = ii.InvoiceItemID
	join #Stuff stf on stf.StuffID = ii.StuffID
	join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
	join sle.saletype stype on q.SaleTypeID = stype.SaleTypeID
	join cfg.Party p on p.PartyID = q.CustomerID
	left join acc.dl d on d.dlid = p.dlid
	left join ACC.VatRate Vat on Vat.FinanCialperiodID=q.FinanCialperiodID
	Left join #Address a on a.AddressId = i.AddressID
	JOIN CFG.[User] us on us.UserID=q.Creator
	JOIN CFG.[User] us1 on us1.UserID=q.LastEditor
	LEFT JOIN sle.SaleAgent sg ON sg.SaleAgentID = i.SaleAgentID
	LEFT JOIN CFG.Party part ON part.PartyID = sg.PartyID
	LEFT JOIN ACC.DL dls ON dls.DLID = part.DlID 
	left join cfg.vwphone  phone on phone.partyid = q.CustomerID
	order by q.number'
	
	print @Query

	SET @Param = N'@IsBranchInstalled bit,
				   @DateType    VARCHAR(10),
				   @DateFormat  VARCHAR(10),
				   @CultureNo int'
	
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@IsBranchInstalled = @IsBranchInstalled,
				@DateType = @DateType,
				@DateFormat = @DateFormat,
				@CultureNo = @CultureNo
END

