
CREATE   proc FIN.SpResourcesConsumptionDetail
(@FromDate DATE,
@ToDate DATE,
@SelectedCashStructures nvarchar(max) = null,
@SelectedBranches nvarchar(max) = null,
@SelectedSubjects nvarchar(max) = null --N'Receive#ReceiptTypeID1|R#ReceiptTypeID2|Payment#PaymentTypeID1'
)
as
	declare @FilterCategoryIDs nvarchar(max) ,
			@Culture NVARCHAR(5),
			@CultureNo CHAR(1)

	SELECT VALUE BranchID into #SelectedBranch
	FROM CFG.R_FnCommaStr2Table(@SelectedBranches)
			
	SELECT * into #vwBranchAccess
	FROM cfg.vwBranchAccess AS vba
		
	SELECT vba.* into #BranchAccess
	FROM #vwBranchAccess AS vba
	left join #SelectedBranch AS sb on vba.BranchID = sb.BranchID
	WHERE (@SelectedBranches is NULL or sb.BranchID is NOT NULL) 

	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	  IF OBJECT_ID('tempdb..#FilterCategory') IS Not NULL
	 DROP TABLE #FilterCategory

	 create table #FilterCategory
	 (
	 [level] int
	 )

	 insert into #FilterCategory
	 select [CFG].[GetStringPartBySpliter](value,1,'#')
	 from [CFG].[Split] (@SelectedCashStructures,'|')

	select @FilterCategoryIDs = STUFF(
										(SELECT DISTINCT ',' +  [CFG].[GetStringPartBySpliter](value,2,'#') 
										 from [CFG].[Split] (@SelectedCashStructures,'|')
										 FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,''
									 )

	 IF OBJECT_ID('tempdb..#FilterCategoryIDs') IS Not NULL
	 DROP TABLE #FilterCategoryIDs

	 create table #FilterCategoryIDs
	 (
	 CashStructureID int
	 )

	 insert into #FilterCategoryIDs
	 select value
	 from [CFG].[Split] (@FilterCategoryIDs,',')

	  IF OBJECT_ID('tempdb..#FilterSubject') IS Not NULL
	 DROP TABLE #FilterSubject

	 create table #FilterSubject
	 (
	 SubjectType nvarchar(50),
	 SubjectTypeID int
	 )

	 insert into #FilterSubject
	 select
		case [CFG].[GetStringPartBySpliter](value,1,'#') 
				when 'p' then 'Payment'
				when 'r'then 'Receive' 
				end SubjectType
		,[CFG].[GetStringPartBySpliter](value,2,'#')
	 from [CFG].[Split] (@SelectedSubjects,'|')

	if OBJECT_ID('tempdb..#CashStructure') is not null  drop table #CashStructure
	if OBJECT_ID('tempdb..##CashStructureTemp1') is not null  drop table ##CashStructureTemp1
	if OBJECT_ID('tempdb..##CashStructureTemp') is not null  drop table ##CashStructureTemp
	if OBJECT_ID('tempdb..#ResourcesConsumption') is not null  drop table #ResourcesConsumption



	select CashStructureID
	into #CashStructure
	from
	(
		select CashStructureID 
		from fin.ReceiptType
		where CashStructureID is not null
		union all
		select CashStructureID 
		from fin.PaymentType
		where CashStructureID is not null
	)a
	group by CashStructureID

	declare @Columns nvarchar(max),
			@Query   nvarchar(max)
	select @Columns = STUFF(
							(SELECT DISTINCT ',' +  QUOTENAME([Order])
								from fin.CashLevel
								FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,''
							)
	set @Query = N'
	;WITH cte
	AS (
		select  b.CashStructureID,
				b.ParentID,
				a.CashStructureID LastNode,
				c.[Order]
		from #CashStructure a
		join fin.CashStructure b on a.CashStructureID = b.CashStructureID
		join fin.CashLevel c on c.CashLevelID = b.CashLevelID
		union all
		select  b.CashStructureID,
				b.ParentID,
				a.LastNode,
				c.[Order]
		from cte a
		join fin.CashStructure b on a.ParentID = b.CashStructureID
		join fin.CashLevel c on c.CashLevelID = b.CashLevelID
	   )
	   select * 
	   into ##CashStructureTemp1
	   from
	   (select LastNode,
			   CashStructureID,
			   [Order]
	   from cte a
		)x
		pivot
		(
		max(CashStructureID)
		for [Order] in ('+@Columns+')
		)p
		'
		exec(@Query)

	declare @i int ,@WhereClose nvarchar(max)
	select @i = max([order])
	from fin.CashLevel

	while @i >= 1
	begin
		set @WhereClose = N'  ('+cast(@i as varchar(10))+' not in (select level from #FilterCategory) or p.'+QUOTENAME(@i)+
							   ' in (select CashStructureID from #FilterCategoryIDs)) and'
		set @i = @i - 1
	end
	set @WhereClose = STUFF(@WhereClose,len(@WhereClose)-2, 3, '')
	set @Query = N'
	select LastNode
	into ##CashStructureTemp
	from ##CashStructureTemp1 p
	where '+ @WhereClose

	exec(@Query)

	declare @Received nvarchar(150),@Payment nvarchar(150)
	set @Culture = cfg.GetuserCulture();

	SELECT @Received = Value
	FROM cfg.LocalizeEnumValue i
	join cfg.LocalizeEnum h on i.LocalizeEnumID = h.LocalizeEnumID
	where Enum = 'CommitmentType'
	and Item = 'Received'
	and Culture = @Culture

	SELECT @Payment = Value
	FROM cfg.LocalizeEnumValue i
	join cfg.LocalizeEnum h on i.LocalizeEnumID = h.LocalizeEnumID
	where Enum = 'CommitmentType'
	and Item = 'Payment'
	and Culture = @Culture

	select a.[Type],
			case when a.[Type] = 'Receive' then @Received 
					   when a.[Type] = 'Payment' then @Payment 
				end [TypeString],
			CASE DocumentType
				   WHEN 'Cheque' THEN
					   N'چک'
				   WHEN 'ReceivedBankDraft' THEN
					   N'واریز'
				   WHEN 'PaymentBankDraft' THEN
					   N'برداشت'
				   WHEN 'Cash' THEN
					   N'نقد'
				   WHEN 'FromCustomers' THEN
					   N'فروشگاه'
				   WHEN 'Change' THEN
					   N'تبدیل ارز'
				   WHEN 'PettyCashCost' THEN
					   N'صورتخلاصه تنخواه'
				   WHEN 'DebitCreditNote' THEN
					   N'اعلامیه بدهکار بستانکار'
				   WHEN 'Wage' THEN
					   N'کارمزد'
			   END DocumentType,
			DocumentEngName,
			a.DocumentID,
			a.SubjectTypeID,
			a.SubjectType,
			case when @CultureNo = 1 then SubjectTitle else SubjectTitle2 end SubjectTitle,
			Date,
			cfg.GetCLRSaturnDate(date,'YYYY/MM/DD',0,0) Date_Date,
			Amount,
			case when @CultureNo = 1 then cu.Title else cu.Title2 end CurrencyTitle, 
			AmountInBaseCurrency,
			a.DlCode,
			case when @CultureNo = 1 then DlTitle else DlTitle2 end DlTitle,
			ba.Code BranchCode,
			case when @CultureNo = 1 then ba.Title else ba.Title2 end  BranchTitle,
			case when @CultureNo = 1 then BankOrCashTitle else BankOrCashTitle2 end  BankOrCashTitle,
			case when @CultureNo = 1 then Description else Description2 end Description,
			CASE
				WHEN a.CashID is NOT NULL or a.BankAccountID is NOT NULL or a.PettyCashID IS NOT NULL THEN 
					CASE WHEN @CultureNo = 1 THEN a.BankOrCashTitle ELSE a.BankOrCashTitle2 END
				ELSE 					
					CASE WHEN @Culture = 'fa' THEN 'تهاتر حساب' ELSE 'Offset Account' END
			END AS PlaceOfReceiptPayment
	from [FIN].VWResourcesConsumption a
	join cfg.Currency cu on cu.CurrencyID = a.CurrencyID
	join cfg.Branch ba on ba.BranchID = a.BranchID
	join #BranchAccess vba on vba.BranchID = a.BranchID
	left join ##CashStructureTemp b on a.CashStructureID = b.LastNode
	left join #FilterSubject c on c.SubjectType = a.Type and c.SubjectTypeID = a.SubjectTypeID
	LEFT JOIN CFG.Cash cash
		ON a.CashID = cash.CashID
	LEFT JOIN CFG.BankAccount bankAccount
		ON a.BankAccountID = bankAccount.BankAccountID
	LEFT JOIN FIN.PettyCash pettyCash
		ON a.PettyCashID = pettyCash.PettyCashID
	LEFT JOIN CFG.Party party
		ON pettyCash.PartyID = party.PartyID
	where a.CashStructureID is not null
	and (
    @SelectedCashStructures is null
    or a.CashStructureID in (
        select CashStructureID
        from #FilterCategoryIDs
		)
	)
	and (@SelectedSubjects is null or c.SubjectTypeID is not null)
	and Date BETWEEN @FromDate AND @ToDate;

