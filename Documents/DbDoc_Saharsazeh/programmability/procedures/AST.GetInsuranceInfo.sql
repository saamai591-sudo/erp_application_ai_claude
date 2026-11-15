-------------------------------------
CREATE   PROCEDURE [AST].GetInsuranceInfo
@FinancialPeriod int,
@Date Date,
@AssetIDs nvarchar(MAX) = Null
--WITH ENCRYPTION 

AS
BEGIN
		if exists (
		select * from ast.AssetClosingOperation 
		where FinancialPeriodID = @FinancialPeriod)	
		begin
			RAISERROR('به دلیل بسته بودن سیستم دارایی ثابت، انجام این عملیات مجاز نیست.', 16, 10)
			return
			end
	
	declare @PrecisionDigit tinyint,
			@UserID int,
			@Culture varchar(25),
		    @CultureNo TINYINT
		    
			
			select value Assetid into #SelectedAssets
			from cfg.R_FnCommaStr2Table(@AssetIDs)
		 
		    
	  SELECT * INTO #vwBranchAccess
	  FROM cfg.vwBranchAccess AS vba


	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	set @PrecisionDigit = cfg.GetBaseCurrencyPrecision()

	-- سهم هر پلاک از کل مبلغ پیش پرداخت 
	select i1.InsuranceID,ii1.InsuranceItemID,round(Price * (ii1.EstimatedValue / SumEstimatedValue),@PrecisionDigit) TotalShare
	into #TTT
	from ast.InsuranceItem ii1
	left join #SelectedAssets sa on ii1.AssetID = sa.Assetid
	join (	
			select i2.InsuranceID,i2.Price , sum(ii2.EstimatedValue) SumEstimatedValue
			from  ast.Insurance i2
			join ast.InsuranceItem ii2 on i2.InsuranceID = ii2.InsuranceID
			where FromDate <= @Date		
			group by i2.InsuranceID,i2.Price 
		 ) i1 on i1.InsuranceID = ii1.InsuranceID
	 where  (@AssetIDs is null or sa.Assetid is not null)
		 


	select  t.InsuranceID,t.InsuranceItemID,t.TotalShare,isnull(tt.remained,0) remained,ROW_NUMBER() over(order by TotalShare) rownum
	into #TTTT
	 from #TTT t left join 
	 (select i.InsuranceID,i.Price - sum(t.TotalShare) remained
		 from #TTT t
		 join ast.Insurance i on i.InsuranceID = t.InsuranceID
	 	 group by  i.InsuranceID,i.Price
		 having sum(t.TotalShare) <> i.Price) tt
	 on t.InsuranceID = tt.InsuranceID


	 update #TTTT
	 set TotalShare = TotalShare + remained
	 where rownum = 1

	
	 -- داراییهایی که هنوز هزینه بیمه آنها بطور کامل محقق نشده اند شناسایی می شوند

	select ii.InsuranceItemID,ii.InsuranceID,ii.AssetID,t.TotalShare,i.FromDate,i.EndDate
	into #IncludedAsset
		from #TTTT t
		join ast.InsuranceItem ii on ii.InsuranceItemID = t.InsuranceItemID
		join ast.Insurance i on ii.InsuranceID = i.InsuranceID
		join ast.Asset a on a.AssetID = ii.AssetID
		left join ast.InsuranceSharing ish on t.InsuranceItemID = ish.InsuranceItemID
		where ((a.Status = 1 or @AssetIDs is not null)) 
		and (ish.date is null or ish.date <> @date)
		and FromDate <= (select enddate from cfg.FinancialPeriod where FinancialPeriodID = @FinancialPeriod)
		group by ii.InsuranceItemID,ii.InsuranceID,ii.AssetID,t.TotalShare,i.FromDate,i.EndDate
		having t.TotalShare > isnull(sum(ish.sharingvalue),0)

	

	DECLARE @StartDate DATE
	
	select  @StartDate = startdate
	from cfg.financialperiod
	where FinancialPeriodID = @FinancialPeriod

	delete from AST.InsuranceSharing_Temp


--آخرین وضعيت سال قبل	
---1. دارایی هایی که در طول محاسبه بیمه تغییر موقعیت داشته اند و شروع بیمه نامه آنها قبل از تاریخ تغییر موقعیت واقع شده

	insert into AST.InsuranceSharing_Temp
	select  B.AssetID,B.InsuranceItemID,A.assetsettingID,
			DateDiff(DAY,CASE WHEN b.FromDate>@StartDate then b.FromDate Else @StartDate END,
			DATEADD(DAY,-1,CASE WHEN b.EndDate>astg2.[Date] then astg2.[Date] else b.EndDate END)
			)+1 AS [DateDiff],
			0,B.TotalShare,B.FromDate,B.EndDate
	from
	(SELECT ROW_NUMBER() OVER (PARTITION  by astg.AssetID ORDER BY astg.[Date] desc ) rno,astg.AssetID,astg.AssetSettingID
	                                                       FROM ast.AssetSetting AS astg
	 WHERE astg.[Date]<@StartDate	) a
	left join ast.AssetSetting AS astg2 on astg2.ParentID = a.AssetSettingID and astg2.[Date] between @StartDate and @Date
	join #IncludedAsset B on A.AssetID = B.AssetID and a.rno = 1
	WHERE astg2.[Date] is NOT NULL
	and astg2.[Date]>b.FromDate


	--select 1,* from ast.InsuranceSharing_Temp


	--2. داراییهایی که در بازه محاسبه تغییر موقعیت نداشته اند.
	
	insert into AST.InsuranceSharing_Temp
	select  B.AssetID,B.InsuranceItemID,A.assetsettingID,
			DateDiff(DAY,CASE WHEN b.FromDate>@StartDate then b.FromDate Else @StartDate END,
			DATEADD(DAY,-1,CASE WHEN b.EndDate>@Date then @Date else b.EndDate END)
			)+1 AS [DateDiff],
			0,B.TotalShare,B.FromDate,B.EndDate
	from
	(SELECT ROW_NUMBER() OVER (PARTITION  by astg.AssetID ORDER BY astg.[Date] desc ) rno,astg.AssetID,astg.AssetSettingID
	                                                       FROM ast.AssetSetting AS astg
	 WHERE astg.[Date]<@StartDate	) a
	left join ast.AssetSetting AS astg2 on astg2.ParentID = a.AssetSettingID and astg2.[Date] between @StartDate and @Date
	join #IncludedAsset B on A.AssetID = B.AssetID and a.rno = 1
	WHERE astg2.[Date] is  NULL
	
	--select 2,* from ast.InsuranceSharing_Temp


	
	
--وضعيتهاي سال جديد	
	insert into AST.InsuranceSharing_Temp
	select A1.AssetID,i.InsuranceItemID,A1.assetsettingID,
	DateDiff(day,case when i.FromDate > A1.Date then I.FromDate else A1.Date end
				,case when isnull(dateadd(day,-1,a2.Date),@Date) > i.EndDate or @Date > i.EndDate then i.EndDate 
					  when isnull(dateadd(day,-1,a2.Date),@Date) <= i.EndDate then ISNULL(dateadd(day,-1,a2.Date),@Date) else dateadd(day,-1,a2.Date) end 
			)+1 AS [DateDiff],0,TotalShare,FromDate,EndDate
	from ast.assetsetting A1
	left join ast.assetsetting  A2 on A1.assetsettingID = A2.ParentID
	join #IncludedAsset i on i.AssetID = A1.AssetID 
	join AST.Asset a on A1.AssetID = a.AssetID
	INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = a.BranchID
	where A1.date between @StartDate and @Date

	

	Declare @Columns nvarchar(max),
			@Query nvarchar(max),
			@ColumnsInSelect nvarchar(max),
			@ColumnsInGroupBy nvarchar(max)
			
	select @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(DlTypeID) 
									FROM acc.UsedDlType  WHERE SaturnModuleID = 14
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   
	if(@Columns is null)
	set @Columns = '[-1]'
	
	select @ColumnsInSelect = STUFF((SELECT DISTINCT ' ,' +QUOTENAME(DlTypeID)+' as T' +cast(DlTypeID as nvarchar(150))
									FROM acc.UsedDlType  WHERE SaturnModuleID = 14
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   
	if(@ColumnsInSelect is null)
	set @ColumnsInSelect = ''

	select @ColumnsInGroupBy = STUFF((SELECT DISTINCT ' ,' +QUOTENAME(DlTypeID)
									FROM acc.UsedDlType  WHERE SaturnModuleID = 14
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   
	if(@ColumnsInGroupBy is null)
	set @ColumnsInGroupBy = ''

	declare @DateType TINYINT,
			@DateFormat VARCHAR(50)



	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	SET @DateType = CASE cfg.GetuserCulture() WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID =  @UserID	

   

	IF @DateFormat IS NULL
		SET @DATEFORMAT = 'YY/MM/DD' 


		
	SET @Query = N'
	select S.AssetSettingID,A.AssetID,A.Plaque,A.Title,A.Title2,
	CFG.GetCLRSaturnDate(s.Date,'''+@DateFormat+' '' , 0,'+cast(@DateType as varchar(10))+')AS Date
	,b.title as Branch,b.Title2 as Branch2'+@ColumnsInSelect+'
	from AST.InsuranceSharing_Temp T
	LEFT join AST.AssetSetting S on S.AssetSettingid = T.AssetSettingID
	LEFT JOIN AST.Asset A ON A.AssetID = S.AssetID
	LEFT join cfg.branch b on b.branchid = A.branchid
	LEFT JOIN 
	(
	select AssetSettingID,asd.DlTypeID,
	case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then d.Title
	        when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then d.Title2
	   end as Title 
	from ast.AssetSettingDl asd
	JOIN acc.Dl d ON asd.DlID = d.DLID 
	)x pivot
	(
	max(Title)
	for DlTypeID in ('+@Columns+')
	)p on p.AssetSettingID = s.AssetSettingID 
	where [DateDiff] > 0
	group by S.AssetSettingID,A.AssetID,A.Plaque,A.Title,A.Title2,s.Date,b.title,b.Title2'+@ColumnsInGroupBy
	print @Query
	EXEC (@Query)


END
