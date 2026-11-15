
------------------------------------------------------			
CREATE   proc [STM].SpRptPurchaseRequest
	@ID nvarchar(max)
--WITH ENCRYPTION 
AS
	BEGIN
		SELECT [value] id INTO #Ids
		FROM   cfg.R_FnCommaStr2Table(@ID)

		Declare @Columns AS NVARCHAR(MAX),
				@Query  AS NVARCHAR(MAX),
				@CustomeFields  AS NVARCHAR(MAX),
				@CustomeFieldSelect  AS NVARCHAR(MAX),
				@DateType  VARCHAR(10),
				@DateFormat VARCHAR(10),
				@UserID INT,
				@Culture varchar(10),
				@CulturNo Tinyint


			SET  @UserID=cfg.GetuserID()
			set @Culture = CFG.GetuserCulture()


			select @CulturNo = CultureNo
			from cfg.CultureInfo
			where Culture = @Culture

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
											WHERE EntityName = 'PurchaseRequest'
											FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,'')
		if(@CustomeFields is null)								   
		set @CustomeFields = '[NoCustomeField]' 

		select @CustomeFieldSelect =  STUFF((SELECT distinct ',CustomEntities.' + QUOTENAME(Fieldname)  + ' As cf_'+ Fieldname
											FROM cfg.EntityCustomeField
											WHERE EntityName = 'PurchaseRequest'
											FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,'')
		if(@CustomeFieldSelect is null)								   
			SET @CustomeFieldSelect = '[NoCustomeField]' 


		select	StuffID,
				Code,
				case when @CulturNo = 1 then Title else Title2 end Title,
				StuffGroupCode,
				case when @CulturNo = 1 then StuffGroupTitle else StuffGroupTitle2 end StuffGroupTitle,
				case when @CulturNo = 1 then MainMeasureUnit else MainMeasureUnit2 end MeasureUnit,
				TechnicalCode
		into #VWStuff
		from stf.VWStuff

		set @Query = N'
		select 
				a.PurchaseRequestNumber,
				CFG.GetCLRSaturnDate(a.PurchaseRequestDate, '''+@DateFormat+'''  , 0, '''+@DateType+''') [date],
				cfg.GetCLRSaturnDate(a.PurchaseRequestDate,''YYYY'',0,0) PurchaseRequestYear,
				o.Title PurchaseRequester,
				O.Code PurchaseRequesterCode,
				a.PurchaseRequestID,
				q.MainQuantity,
				q.AcceptRequestMainMeasureQuantity,
				q.AcceptRequestSubMeasureQuantity,
				stf.Title stuffTitle,
				q.PurchaseRequestItemIndex,
				stf.MeasureUnit,
				stf.TechnicalCode,
				PurchaseRequestState,
				' + @Columns + ',
				'+@CustomeFieldSelect+',
				stf.Code StuffCode,
				stf.StuffGroupCode,
				stf.StuffGroupTitle,
				q.Description,
				u1.name creator,
				u2.name lasteditor,
				q.StuffID,
				q.PurchaseRequestItemID
		from REQ.[PurchaseRequest] a
		join cfg.[user] u1 on u1.userid = a.creator
		join cfg.[user] u2 on u2.userid = a.lasteditor
		join #Ids on #Ids.id = a.PurchaseRequestID
		join REQ.PurchaseRequestItem q on q.PurchaseRequestID=a.PurchaseRequestID
		join cfg.OrganizationUnit o on o.OrganizationUnitID = a.OrganizationUnitID
		left join 
		(
			select	PurchaseRequestItemID,
					TraceID,
					Case When tr.DLID IS NOT NULL THEN cast ((select title from acc.DL u where u.DLID=tr.DlID) as nvarchar(max)) else Value end Value
			from REQ.PurchaseRequestItemTrace tr
		) x
		pivot 
		(
			max(Value)
			for TraceID in ( ' + @Columns + ')
		)  piv on piv.PurchaseRequestItemID = q.PurchaseRequestItemID
		join #VWStuff stf on stf.StuffID =q.StuffID
		left join 
		(
			SELECT	ecf.EntityID,
					ecfd.Fieldname,
					case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], '''+@DateFormat+'''  , 0, '''+@DateType+''') else  ecf.[Value] end as Value
			FROM cfg.EntityCustomeField ecfd
			left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
			WHERE ecfd.EntityName = ''PurchaseRequest''
		)x
		pivot 
		(
			max(Value)
			for Fieldname IN ('+@CustomeFields+')
		) CustomEntities on CustomEntities.EntityID = q.PurchaseRequestID'

		EXECUTE sp_executeSQL     
					@Query;
	END;
