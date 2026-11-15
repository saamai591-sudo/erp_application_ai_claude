
------------------------------------- START #65323
CREATE   PROC   [STM].SpRptInvoice 
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
			@OutgoingCustomeFields     AS NVARCHAR(MAX),
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

	IF (@CustomeFields IS NULL)
		SET @CustomeFields = '[NoCustomeField]' 

	SELECT @CustomeFieldSelect = STUFF(
           (
               SELECT DISTINCT ',CustomEntities.' + QUOTENAME(Fieldname) + ' As cf_' + Fieldname
               FROM   cfg.EntityCustomeField
               WHERE  EntityName = 'invoice'
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

	IF (@CustomeFieldSelect IS NULL)
		SET @CustomeFieldSelect = '[NoCustomeField]' 

	SELECT @OutgoingCustomeFields = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(Fieldname)
               FROM   cfg.EntityCustomeField
               WHERE  EntityName = 'Outgoing'
                      FOR XML PATH(''), TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )

	IF (@OutgoingCustomeFields IS NULL)
		SET @OutgoingCustomeFields = '[NoOutgoingCustomeField]' 
								   
	SELECT  *
	into #TaxData
	from cfg.TaxData
	where DocumentName = 'Invoice'

	select *
	into #Stuff
	from stf.VWStuff

	select a.*
	into #Address
	from [CFG].[FULLAddressForAllParties]() a
	join 
	(
	select CustomerID
	from sle.Invoice b 
	join #Ids c on c.id = b.InvoiceID
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
						q.InvoiceID,
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
						case when @CultureNo = 1 then  sar.Title  else sar.Title2 End SaleAreaTitle,
						case when @CultureNo = 1 then  a.[Address] else a.Address2 End [Address],
						q.date InvoiceDate,
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
						qi.MainQuantity,
						qi.SubQuantity,
						qi.Fee,
						qi.Price,
						qi.Discount,
						qi.Tax,
						qi.Duty,
						qi.Netprice,
						q.TotalDiscount,
						q.TotalDuty,
						q.TotalNetPrice,
						stf.UniqueTaxID StuffUniqueTaxID,
						q.TotalPrice,
						q.TotalTax,
						qi.RowIndex,
						SubMeasureUnit SubUnitTitle,
						' + @SelectColumns + ',
						Vat.TaxRate,
						stf.TechnicalCode,
						Vat.DutyRate,
						qi.Description,
						qi.SaleModelID,
						qi.InvoiceItemID,
						p.CustomerCode,
						d.code DlCode,
						case when @CultureNo = 1 then  dls.Title else dls.Title2 End AgentName,
						Percentage,
						' + @CustomeFieldSelect + ',
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
						outgoingCustomEntities.*,
						o.number  OutgoingNumber,
						CFG.GetCLRSaturnDate(o.[date] , @DateFormat  , 0,  @DateType ) [OutgoingDate],
						qu.Number quotation_Number,
						Case when qi.Price=0 then 0 Else qi.Discount / qi.Price End DiscountPercent  ,
						Case stf.type when 0 then ''STUFF'' else ''Service'' End StuffType   ,
						CASE   isnull(qi.Description ,'' '' ) when '' ''   THEN  stf.Title
						else qi.Description
						END StuffTitle_With_Description ,
						case when @IsBranchInstalled = 1 then  branch.Title else '''' end  BranchTitle,
						cmp.Title CompanyTitle,
						cmp.NationalID CompanyNationalID,
						cmp.RegistrationNumber CompanyRegistrationNumber,
						q.CurrencyRate,
						TaxData.UniqueTaxID,
						stf.IranCode
	from sle.Invoice q
	join sle.SaleArea sar on q.SaleAreaID = sar.SaleAreaID
	Inner join #Ids on #ids.Id=q.InvoiceID
	left join #TaxData TaxData on TaxData.DocumentID = q.InvoiceID
	join cfg.currency on currency.currencyid = q.currencyid
	join sle.InvoiceItem qi on q.InvoiceID = qi.InvoiceID
	join sle.SaleModel smodel on qi.SaleModelId = smodel.SaleModelID
	Left join sle.quotationitem quo on quo.quotationitemid=qi.quotationitemid
	left join sle.quotation qu on qu.quotationid=quo.quotationid
	join CFG.Branch branch on branch.branchID=q.branchID
	join cfg.Company cmp on branch.CompanyID = cmp.CompanyID
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
	)  piv on piv.InvoiceItemID = qi.InvoiceItemID
	join #Stuff stf on stf.StuffID = qi.StuffID
	join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
	join sle.saletype stype on q.SaleTypeID = stype.SaleTypeID
	join cfg.Party p on p.PartyID = q.CustomerID
	left join acc.dl d on d.dlid = p.dlid
	left join ACC.VatRate Vat on Vat.FinanCialperiodID=q.FinanCialperiodID
	Left join #Address a on a.AddressId = q.AddressID
	JOIN CFG.[User] us on us.UserID=q.Creator
	JOIN CFG.[User] us1 on us1.UserID=q.LastEditor
	left join stc.outgoingitem oi on oi.outgoingitemID = qi.outgoingitemID
	left join stc.outgoing o on oi.outgoingID = o.outgoingID
	LEFT JOIN sle.SaleAgent sg ON sg.SaleAgentID = q.SaleAgentID
	LEFT JOIN CFG.Party part ON part.PartyID = sg.PartyID
	LEFT JOIN ACC.DL dls ON dls.DLID = part.DlID 
	left join 
	(
	SELECT ecf.EntityID,ecfd.Fieldname,
	case when b.LookupDataItemID is not null then b.title
	 when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value],  @DateFormat , 0,  @DateType ) else  ecf.[Value] end as Value
	 FROM cfg.EntityCustomeField ecfd
	left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
	left join cfg.LookupDataItem b on ecf.LookupDataItemID = b.LookupDataItemID
	WHERE ecfd.EntityName = ''invoice''
	)x
	pivot 
	(
		max(Value)
		for Fieldname IN (' + @CustomeFields + ')
	) CustomEntities on CustomEntities.EntityID = q.InvoiceID
	left join 
	(
	SELECT * FROM
	(SELECT ecf.EntityID,ecfd.Fieldname,
	case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value],@DateFormat  , 0,  @DateType) else  ecf.[Value] end as Value
	 FROM cfg.EntityCustomeField ecfd
	left JOIN cfg.EntityCustomeFieldData ecf
	 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
	WHERE ecfd.EntityName = ''Outgoing''
	)x
	pivot 
	(
		 max(Value)
		for Fieldname IN (' + @OutgoingCustomeFields + ')
	)  piv	
	)outgoingCustomEntities on outgoingCustomEntities.EntityID = o.outgoingID
	left join cfg.vwphone  phone on phone.partyid = q.CustomerID
	order by q.number,qi.RowIndex'

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
