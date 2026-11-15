

CREATE   PROCEDURE [APT].[ApportionReview_Portioner]
	@CurrentFinancialPeriodID int,
	@SelectedApportionPeriods varchar(max) = null,
	@SelectedPortionedTos varchar(max) = null
AS
BEGIN

	declare @Columns NVARCHAR(max),
			@Query NVARCHAR(max),
			@And  NVARCHAR(max),
			@Groupby NVARCHAR(max),
			@Select NVARCHAR(max),
			@Param NVARCHAR(max),
			@Culture varchar(25),
			@CultureNo tinyint

	set @Culture = CFG.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @Columns = STUFF((SELECT  ',' + QUOTENAME(AccountLevelID)+' int'
	               FROM   acc.AccountLevel	 
				   where AccountLevelTypeID = 1    
				   order by AccountLevelID
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')

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


	if object_id('tempdb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos
			
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##PortionerAnalysis')
		DROP TABLE ##PortionerAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##VoucherAnalysis')
		DROP TABLE ##VoucherAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ApportionCalculation')
		DROP TABLE ##ApportionCalculation

	create table #FinalResult
	(
		ID int identity(1,1) not null,
		ApportionPeriodCalculationID int not null,
	    PortionerItemID int not null,
	    ApportionPeriod nvarchar(256) not null,
		PortionerGroup nvarchar(256) not null,
		SlCode varchar(50) not null,
		SlName nvarchar(256) not null,
		PortionerCode int not null,
		PortionerTitle nvarchar(256) not null,
		AmountBeforeSharing decimal(30, 4) not null,
		ShareOfApportion decimal(30, 4) not null,
		Apportionable decimal(30, 4) not null
	)


	SELECT [CFG].[GetStringPartBySpliter](value,1,',') ApportionPeriodCalculationID,
		   [CFG].[GetStringPartBySpliter](value,2,',') PortionedToID
	INTO #Selected_PortionedTos
	FROM CFG.Split(@SelectedPortionedTos,'|')


	set @Query = N'select * into ##PortionerAnalysis from (
		select c.ApportionPeriodCalculationID,
		       a.VoucherID,
		       c.PortionerItemID,
			   i.SlID,
			   al.AccountLevelID,
			   al.DLID
		   		   
		from APT.ApportionCalculationAccountLevel al
		join APT.ApportionCalculation c on al.ApportionCalculationID = c.ApportionCalculationID
		join APT.ApportionPeriodCalculation a on c.ApportionPeriodCalculationID = a.ApportionPeriodCalculationID
		JOIN APT.PortionerItem i on i.PortionerItemID = c.PortionerItemID
		) x
		pivot
		(
		max(DLID)
		for AccountLevelID in ('+@Columns+')
		)P'

	exec (@Query)


	set @Query = N'select * into ##VoucherAnalysis from (
		select i.VoucherID,i.VoucherItemID,SlID,AccountLevelID,DLID,Debit,Credit
	    from ACC.Voucher v 
	    join ACC.VoucherItem i on v.VoucherID = i.VoucherID
		join ACC.AccountLevelVoucherItem a on i.VoucherItemID = a.VoucherItemID
		join APT.ApportionPeriod ap on v.Date between ap.StartDate and ap.EndDate						
		) x
		pivot
		(
		max(DLID)
		for AccountLevelID in ('+@Columns+')
		)P'

	exec (@Query)


	set @Query = N'select a.ApportionPeriodCalculationID,
	                      a.PortionerItemID,
						  a.SlID,'+@Select+',isnull(sum(debit)-sum(credit),0) Amount
				   into ##ApportionCalculation
				   from ##PortionerAnalysis a 
				   left join ##VoucherAnalysis b on b.SlID = a.SlID
				   '+@And+'
				   where a.VoucherID is null or a.VoucherID <> b.VoucherID
				   group by a.ApportionPeriodCalculationID,a.PortionerItemID,a.SlID,'+@Groupby
					
	exec (@Query)


	insert into #FinalResult 
	select c.ApportionPeriodCalculationID,
	       c.PortionerItemID,
		   case when @CultureNo = 1 then p.Title
	            when @CultureNo = 2 then p.Title2
	       end,
		   case when @CultureNo = 1 then g.Title
	            when @CultureNo = 2 then g.Title2
	       end,
		   ACC.SlFullCode(i.SlID),
		   case when @CultureNo = 1 then s.Title
	            when @CultureNo = 2 then s.Title2
	       end,
		   o.Code,		   
		   case when @CultureNo = 1 then o.Title
	            when @CultureNo = 2 then o.Title2
	       end,
		   isnull(ac.Amount,0),
		   isnull(api.Amount,0) - isnull(ac.Amount,0),
		   isnull(ac.Amount,0) + (isnull(api.Amount,0) - isnull(ac.Amount,0))

	from APT.ApportionCalculation c
	join APT.ApportionPeriodCalculation a on c.ApportionPeriodCalculationID = a.ApportionPeriodCalculationID
	join APT.ApportionPeriod p on a.ApportionPeriodID = p.ApportionPeriodID	
	join APT.PortionerItem i on c.PortionerItemID = i.PortionerItemID
	join APT.Portioner o on i.PortionerID = o.PortionerID
	join APT.ApportionGroup g on o.ApportionGroupID = g.ApportionGroupID
	join ACC.SL s on i.SlID = s.SlID
	left join ##ApportionCalculation ac on ac.ApportionPeriodCalculationID = c.ApportionPeriodCalculationID and
		ac.PortionerItemID = c.PortionerItemID and ac.SlID = i.SlID
	left join (select ApportionCalculationID,Sum(Amount) Amount
			   from APT.ApportionCalculationItem			   
			   group by ApportionCalculationID
			  ) api on c.ApportionCalculationID = api.ApportionCalculationID
	where p.FinancialPeriodID = @CurrentFinancialPeriodID and
		(@SelectedApportionPeriods is null or
			a.ApportionPeriodID in (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedApportionPeriods))) and
		(@SelectedPortionedTos is null or		 
		 (c.ApportionPeriodCalculationID in (select ApportionPeriodCalculationID from #Selected_PortionedTos) and
		  i.PortionerID in (select PortionerID from 
							 (select po2.PortionerID,po.PortionedToID 
					          from APT.PortioningItem po
					          join APT.Portioning po2 on po.PortioningID = po2.PortioningID
					          where po2.Date between p.StartDate and p.EndDate and
									po.PortionedToID in (select PortionedToID from #Selected_PortionedTos) 						
					          group by po2.PortionerID,po.PortionedToID
							 ) t
							)
		 )
		) 
	order by a.ApportionPeriodCalculationID,o.[Priority],i.RowIndex


	select * from #FinalResult

	if object_id('tempdb..#FinalResult') is not null
		drop table #FinalResult

	if object_id('tempdb..#Selected_PortionedTos') is not null
		drop table #Selected_PortionedTos

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##PortionerAnalysis')
		DROP TABLE ##PortionerAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##VoucherAnalysis')
		DROP TABLE ##VoucherAnalysis

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##ApportionCalculation')
		DROP TABLE ##ApportionCalculation

END

