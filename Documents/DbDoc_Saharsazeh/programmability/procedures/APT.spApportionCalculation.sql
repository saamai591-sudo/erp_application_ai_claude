------------------------------------- START #ApportionCalculationTransaction
CREATE   PROC [APT].spApportionCalculation
(
@ApportionPeriodID int
)
--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON;
	-- Ensure statement-terminating errors abort and leave the ambient (caller) transaction uncommittable
	-- so the whole calculation is rolled back together (period header + calculation rows).
	SET XACT_ABORT ON;

	-- Validation errors are collected here; runtime errors are not caught and propagate to the caller as-is.
	IF OBJECT_ID('tempdb..#Error') IS NOT NULL
		DROP TABLE #Error

	create table #Error
	(
	ErrorID int identity(1,1),
	ErrorMessage nvarchar(4000)
	)

	declare @ErrorText NVARCHAR(2000)

	if exists (select * 
				from  [APT].[ApportionPeriodCalculation] 
				where ApportionPeriodID = @ApportionPeriodID
			  )
		insert into #Error(ErrorMessage)
		values(N'برای این دوره قبلا محاسبه انجام شده است.')

	if exists (select * from #Error)
	begin
		select @ErrorText = STUFF((SELECT char(13) + char(10) + ErrorMessage
									FROM #Error
									ORDER BY ErrorID
									FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,2,'')
		RAISERROR(N'%s',16,1,@ErrorText)
		return
	end


	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##PortionerAnalysis')
	DROP TABLE ##PortionerAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##VoucherAnalysis')
	DROP TABLE ##VoucherAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ApportionCalculation')
	DROP TABLE ##ApportionCalculation

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ShareOfPortionerAnalysis')
	DROP TABLE ##ShareOfPortionerAnalysis

	IF OBJECT_ID('tempdb..#T') IS NOT NULL 
		DROP TABLE #T

	create table #T
	(
	ApportionCalculationID int,
	PortionedToID int,
	Amount decimal(36,10),
	Share decimal(36,10),
	LessImportant bit,
	PortionerItemID int,
	JustForDiff bit
	)

	declare @Columns NVARCHAR(max),
			@Query NVARCHAR(max),
			@And  NVARCHAR(max),
			@Groupby NVARCHAR(max),
			@Select NVARCHAR(max),
			@Param NVARCHAR(max),
			@AlterTable NVARCHAR(max),
			@CurrentUser int,
			@CurrentDate Date,
			@ApportionPeriodCalculationID int,
			@StartDate Date,
			@EndDate Date,
			@PortionerItemID INT,
			@Amount decimal(38,10),
			@Total  decimal(38,10),
			@ApportionCalculationID int,
			@Degree int = 1,
			@BaseDigit int,
			@Diff decimal(38,10) = 0

	set @CurrentUser = cfg.GetuserID()
	set @CurrentDate = GETDATE()
	set @BaseDigit = cfg.GetBaseCurrencyPrecision()

	select  @StartDate = StartDate,
			@EndDate = EndDate
	from apt.ApportionPeriod
	where ApportionPeriodID = @ApportionPeriodID

	INSERT INTO [APT].[ApportionPeriodCalculation]
			   ([ApportionPeriodID]
			   ,[VoucherID]
			   ,[Creator]
			   ,[CreationDate]
			   ,[LastEditor]
			   ,[LastEditionDate]
			   ,[Version])
		 VALUES
			   (@ApportionPeriodID,
			    null,
				@CurrentUser,
				@CurrentDate,
				@CurrentUser,
				@CurrentDate,
				0)

	set @ApportionPeriodCalculationID = SCOPE_IDENTITY()

	SELECT @Columns = STUFF((SELECT  ',' + QUOTENAME(AccountLevelID)+' int'
	               FROM   acc.AccountLevel	 
				   where AccountLevelTypeID = 1    
				   order by AccountLevelID
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	
	set @Query = N'
	create table ##ShareOfPortionerAnalysis
	(
	ApportionCalculationID int,
	PortionerItemID int,
	slid int,
	'+@Columns+',
	Amount Decimal(30,4),
	A Decimal(30,4),
	B Decimal(30,4),
	C Decimal(30,4)
	)'

	exec(@Query)

	create table #PivotedVWApportionAccounting
	(
	SlID int,
	Amount Decimal(36,10)
	)

	SELECT @AlterTable = STUFF((SELECT  '  alter table #PivotedVWApportionAccounting add ' + QUOTENAME(AccountLevelID)+' int'
	               FROM   acc.AccountLevel	 
				   where AccountLevelTypeID = 1    
				   order by AccountLevelID
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	if @AlterTable is not null
	exec(@AlterTable)

	SELECT @Columns = STUFF((SELECT  ',' + QUOTENAME(AccountLevelID)
	               FROM   acc.AccountLevel	 
				   where AccountLevelTypeID = 1    
				   order by AccountLevelID
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

	SELECT @And = STUFF((SELECT  ' and (a.' 
								+ QUOTENAME(AccountLevelID) 
								+ ' is null or b.'
								+ QUOTENAME(AccountLevelID) 
								+' = a.'
								+ QUOTENAME(AccountLevelID) 
								+')'
	               FROM   acc.AccountLevel	    
				   where AccountLevelTypeID = 1   
				   order by AccountLevelID        
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')		

	SELECT @Groupby = STUFF((SELECT  ',case when b.' + 
									 QUOTENAME(AccountLevelID) + 
									 ' is not null then b.' +
									 QUOTENAME(AccountLevelID) + 
									' else a.'+ 
									QUOTENAME(AccountLevelID) +
									' END '
	               FROM   acc.AccountLevel	   
				   where AccountLevelTypeID = 1  
				   order by AccountLevelID          
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')			

	SELECT @Select = STUFF((SELECT  ',case when b.' + 
									 QUOTENAME(AccountLevelID) + 
									 ' is not null then b.' +
									 QUOTENAME(AccountLevelID) + 
									' else a.'+ 
									QUOTENAME(AccountLevelID) +
									' END '+
									QUOTENAME(AccountLevelID)
	               FROM   acc.AccountLevel	   
				   where AccountLevelTypeID = 1  
				   order by AccountLevelID          
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')					   	   			      


	select *
	into #Portioning
	from(
	select ROW_NUMBER() over(partition by PortionerID order by date desc) Rno,
	PortionerID,
	PortioningID
	from apt.Portioning
	where Date <= @EndDate
	)a where rno = 1

	set @Query = N' select *
					into ##PortionerAnalysis
					from(
							select PortionerItemID,SlID,AccountLevelID,DLID
							 from apt.PortionerItem a
							join apt.PortionerAccountLevel b 
									on a.PortionerID = b.PortionerID
							join #portioning c
									on c.PortionerID = a.PortionerID
							join 
							(select PortioningID,ApportionBaseID
							from apt.PortioningItem d
							join apt.ApportionBaseValue e
									on e.PortionedToID = d.PortionedToID
							group by  PortioningID,ApportionBaseID
							)d
									on d.PortioningID = c.PortioningID
									and a.ApportionBaseID = d.ApportionBaseID
						)x
					pivot
					(
					max(dlid)
					for AccountLevelID in ('+@Columns+')
					)P'
	exec (@Query)
	

	set @Query = N' select *
					into ##VoucherAnalysis
					from(
							select  a.VoucherItemID,SlID,AccountLevelID,DLID,Debit,Credit
							from acc.voucher v
							join acc.VoucherItem a	
											on a.voucherid = v.voucherid
							join acc.AccountLevelVoucherItem b
											on a.VoucherItemID = b.VoucherItemID
							join APT.ApportionPeriod ap
											on v.Date between ap.StartDate and EndDate
							where ap.ApportionPeriodID = @pApportionPeriodID
						)x
					pivot
					(
					max(dlid)
					for AccountLevelID in ('+@Columns+')
					)P	'

	SET @Param = N'@pApportionPeriodID int'
	EXECUTE sp_executeSQL     
			@Query,
			@Param,
			@pApportionPeriodID = @ApportionPeriodID


	set @Query = N'	Declare @MaxApportionCalculationID int

					select @MaxApportionCalculationID = isnull(max(ApportionCalculationID) + 1 , 1)
					from apt.ApportionCalculation 

					select  row_number() over(order by a.PortionerItemID) + @MaxApportionCalculationID ApportionCalculationID,
							a.PortionerItemID,
							a.SlID,'+@Select+',isnull(sum(debit)-sum(credit),0) Amount
						into ##ApportionCalculation
					from  ##PortionerAnalysis a 
					left join ##VoucherAnalysis b on b.SlID = a.SlID
					'+@And+'
					group by a.PortionerItemID,a.SlID,'+@Groupby
					
	exec (@Query)

	--select * from  ##ApportionCalculation
	--order by PortionerItemID
	--return

	set @Query = N'SET IDENTITY_INSERT  [APT].[ApportionCalculation] on
					INSERT INTO [APT].[ApportionCalculation]
							   ([ApportionCalculationID]
							   ,[ApportionPeriodCalculationID]
							   ,[PortionerItemID]
							   ,[Amount]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate]
							   ,[Version])
					select      [ApportionCalculationID]
							   ,@pApportionPeriodCalculationID
							   ,[PortionerItemID]
							   ,[Amount]
							   ,@pCurrentUser
							   ,@pCurrentDate
							   ,@pCurrentUser
							   ,@pCurrentDate
							   ,0
					from ##ApportionCalculation
				SET IDENTITY_INSERT  [APT].[ApportionCalculation] off

					INSERT INTO [APT].[ApportionCalculationAccountLevel]
							   ([ApportionCalculationID]
							   ,[AccountLevelID]
							   ,[DLID]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate]
							   ,[Version])
					select      [ApportionCalculationID]
							   ,AccountLevelID
							   ,DlID
							   ,@pCurrentUser
							   ,@pCurrentDate
							   ,@pCurrentUser
							   ,@pCurrentDate
							   ,0
					from ##ApportionCalculation
					unpivot
					(
						DlID
						For AccountLevelID in ('+@Columns+')
					)unp '
	SET @Param = N'@pApportionPeriodCalculationID int,@pCurrentUser int,@pCurrentDate date'
	EXECUTE sp_executeSQL     
			@Query,
			@Param,
			@pApportionPeriodCalculationID = @ApportionPeriodCalculationID,
			@pCurrentUser = @CurrentUser,
			@pCurrentDate = @CurrentDate


	SELECT @Groupby = STUFF((SELECT  ',a.' + 
									 QUOTENAME(AccountLevelID) 
	               FROM   acc.AccountLevel	   
				   where AccountLevelTypeID = 1  
				   order by AccountLevelID          
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

	delete from  ##ShareOfPortionerAnalysis
	set @Query = N'insert into ##ShareOfPortionerAnalysis
					select  a.ApportionCalculationID,
							a.PortionerItemID,
							a.slid,'+@Groupby+',
							a.amount,0,0,0
					from ##ApportionCalculation a
					'
	EXECUTE sp_executeSQL     
			@Query


	SELECT @Groupby = STUFF((SELECT  ',b.' + 
									 QUOTENAME(AccountLevelID) 
	               FROM   acc.AccountLevel	   
				   where AccountLevelTypeID = 1  
				   order by AccountLevelID          
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

	create table #PortionerItem
	(
	ApportionCalculationID int,
	PortionerItemID int,
	Amount Decimal(36,10)
	)



	while exists (select * from  ##ShareOfPortionerAnalysis where amount <> 0)
	BEGIN
		--select @Degree,* from ##ShareOfPortionerAnalysis where amount <> 0 order by PortionerItemID

		--print 'start of loop Degree = '
		--print @Degree

		delete from #PortionerItem
		set @Query = N'
					insert into #PortionerItem
					select b.ApportionCalculationID, b.PortionerItemID , b.Amount 
					from ##ShareOfPortionerAnalysis b'+
					case when @Degree > 1 then 
					N' left join #PivotedVWApportionAccounting a
							on b.SlID = a.SlID
							'+@And
							else ' ' end+
					N' where b.amount <> 0'
		EXECUTE sp_executeSQL     
				@Query


	
		DROP TABLE if EXISTS #Source

		select  pi.ApportionCalculationID,e.PortionedToID,p.ImportanceLevel,
				pi.Amount, e.value, convert (float ,SUM(e.value) over(partition by b.PortionerItemID))  SumCostDriver,
				b.PortionerItemID,
				d.LessImportant JustForDiff
		into #Source
		from apt.PortionerItem b
		join #PortionerItem pi on pi.PortionerItemID = b.PortionerItemID
		join apt.portioner p 
				on p.PortionerID = b.PortionerID
		join #Portioning c on c.PortionerID = b.PortionerID
		join apt.PortioningItem d
				on c.PortioningID = d.PortioningID
		join 
		(
		select  ROW_NUMBER() over(partition by e.PortionedToID,e.ApportionBaseID order by f.startdate desc) Rno,
				PortionedToID,
				ApportionBaseID,
				Value
		from apt.ApportionBaseValue e
		join apt.ApportionPeriod f
			on e.ApportionPeriodID = f.ApportionPeriodID
				where f.EndDate <= @EndDate
		) e
				on e.PortionedToID = d.PortionedToID
				and e.ApportionBaseID = b.ApportionBaseID
				and e.Rno = 1
		where  abs(pi.Amount) > isnull(p.ImportanceLevel ,0)
		
		if exists (select * 
				from  #Source 
		           WHERE SumCostDriver = 0
			  )
		insert into #Error(ErrorMessage)
		values(N'برای برخی از مبنای تسهیم، مقدار همه سهم گیرنده ها صفر است.')

		if exists (select * from #Error)
		begin
			IF OBJECT_ID('tempdb..##PortionerAnalysis') IS NOT NULL
				DROP TABLE ##PortionerAnalysis

			IF OBJECT_ID('tempdb..##VoucherAnalysis') IS NOT NULL
				DROP TABLE ##VoucherAnalysis

			IF OBJECT_ID('tempdb..##ApportionCalculation') IS NOT NULL
				DROP TABLE ##ApportionCalculation

			IF OBJECT_ID('tempdb..##ShareOfPortionerAnalysis') IS NOT NULL
				DROP TABLE ##ShareOfPortionerAnalysis

			select @ErrorText = STUFF((SELECT char(13) + char(10) + ErrorMessage
										FROM #Error
										ORDER BY ErrorID
										FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,2,'')
			RAISERROR(N'%s',16,1,@ErrorText)
			return
		end
		
		
		
			delete from #T
		
		insert into #T
		select  s.ApportionCalculationID,s.PortionedToID,
				s.Amount,
				round(convert (float ,s.Amount * s.value) / convert (float ,SUM(s.value) over(partition by s.PortionerItemID)) ,@BaseDigit) Share,
				case when s.Amount > isnull(s.ImportanceLevel,0)
						then 0
						else 1 end LessImportant,
				s.PortionerItemID,
				s.JustForDiff						
		from #Source s


		;with CTE
		as
		(
		select PortionerItemID,MAX(Amount) Amount,sum(Share) Share,MAX(Amount)-sum(Share) Diff
		from #T 
		group by PortionerItemID
		)
		update a
		set Share = a.Share + Diff
		from CTE c
		join #T a on c.diff <> 0 and c.PortionerItemID = a.PortionerItemID and a.JustForDiff = 1
		--join (
		--select ROW_NUMBER() over(order by PortionerItemID) RNo,
		--		PortionerItemID
		--from #T
		--	)b on b.RNo = 1 and b.PortionerItemID = a.PortionerItemID


		INSERT INTO [APT].[ApportionCalculationItem]
					([ApportionCalculationID]
					,[PortionedToID]
					,[Amount]
					,[Degree]
					,[Creator]
					,[CreationDate]
					,[LastEditor]
					,[LastEditionDate]
					,[Version])
		select  ApportionCalculationID,
				PortionedToID,
				Share,
				@Degree,
				@CurrentUser,
				@CurrentDate,
				@CurrentUser,
				@CurrentDate,
				0
		from #T

		INSERT INTO [APT].[ApportionCalculationItem]
					([ApportionCalculationID]
					,[PortionedToID]
					,[Amount]
					,[Degree]
					,[Creator]
					,[CreationDate]
					,[LastEditor]
					,[LastEditionDate]
					,[Version])
		select  pi.ApportionCalculationID,
				e.PortionedToID,
				pi.Amount,
				@Degree,
				@CurrentUser,
				@CurrentDate,
				@CurrentUser,
				@CurrentDate,
				0
		from apt.PortionerItem b
		join #PortionerItem pi on pi.PortionerItemID = b.PortionerItemID
		join apt.portioner p 
				on p.PortionerID = b.PortionerID
		join #Portioning c on c.PortionerID = b.PortionerID
		join 
		(select ROW_NUMBER() over(partition by PortioningID order by PortioningItemid) Rno,
				PortioningID,
				PortionedToID
		from apt.PortioningItem
		where LessImportant = 1
		)d
				on c.PortioningID = d.PortioningID  and d.Rno = 1
		join 
		(
		select  ROW_NUMBER() over(partition by e.PortionedToID,e.ApportionBaseID order by f.startdate desc) Rno,
				PortionedToID,
				ApportionBaseID,
				Value
		from apt.ApportionBaseValue e
		join apt.ApportionPeriod f
			on e.ApportionPeriodID = f.ApportionPeriodID
				where f.EndDate <= @EndDate
		) e
				on e.PortionedToID = d.PortionedToID
				and e.ApportionBaseID = b.ApportionBaseID
				and e.Rno = 1
		where  abs(pi.Amount) <= isnull(p.ImportanceLevel ,0)


		if OBJECT_ID('tempdb..#VWApportionAccounting','u') is not null 
		drop table #VWApportionAccounting
		select * 
		into #VWApportionAccounting
		from  APT.VWApportionAccounting
		where ApportionPeriodID = @ApportionPeriodID
		and Degree <= @Degree

		delete from #PivotedVWApportionAccounting
		set @Query = N'insert into #PivotedVWApportionAccounting
						select SlID,sum(amount) amount ,'+@Columns+'
						from 
						(
						select * from  #VWApportionAccounting
							)x
						pivot
						(
						max(dlid)
						for AccountLevelID in ('+@Columns+')
						) piv
							group by SlID,'+@Columns+'
							
							'
		print 'into #PivotedVWApportionAccounting'
		print sysdatetime()
		EXECUTE sp_executeSQL     
				@Query

		print sysdatetime()

		delete from  ##ShareOfPortionerAnalysis
		set @Query = N'insert into ##ShareOfPortionerAnalysis
						select  a.ApportionCalculationID,
								a.PortionerItemID,
								a.slid,'+@Groupby+',
								a.amount+isnull(b.amount,0)-isnull(c.amount , 0) amount,a.amount,isnull(b.amount,0),isnull(c.amount , 0)
						from ##ApportionCalculation a
						left join #PivotedVWApportionAccounting b
						  on b.SlID = a.SlID
						  '+@And+'
						left join 
						(
						select h.ApportionCalculationID,Sum(i.Amount) Amount
						from apt.ApportionCalculationItem i
						join apt.ApportionCalculation h on i.ApportionCalculationID = h.ApportionCalculationID
						where ApportionPeriodCalculationID = @ApportionPeriodCalculationID
						group by h.ApportionCalculationID
						) c on c.ApportionCalculationID = a.ApportionCalculationID
						where a.amount+isnull(b.amount,0)-isnull(c.amount , 0) <> 0
						'
				
		print 'insert into ##ShareOfPortionerAnalysis'
		print sysdatetime()

		EXECUTE sp_executeSQL     
				@Query,
				N'@ApportionPeriodCalculationID int',
				@ApportionPeriodCalculationID = @ApportionPeriodCalculationID
		print sysdatetime()
	
		set @Degree = @Degree + 1 
	
	END

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##PortionerAnalysis')
	DROP TABLE ##PortionerAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##VoucherAnalysis')
	DROP TABLE ##VoucherAnalysis
	
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ApportionCalculation')
	DROP TABLE ##ApportionCalculation

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ShareOfPortionerAnalysis')
	DROP TABLE ##ShareOfPortionerAnalysis

END
