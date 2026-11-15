
-------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].spGetInventoryInDate
(
    @StuffId NVARCHAR(MAX) = NULL,
    @stockID INT = NULL,
	@ToDate date ,
	@FinalTable nvarchar(MAX)
)
--WITH ENCRYPTION ,RECOMPILE
AS
BEGIN 
DECLARE @Query NVARCHAR(MAX),
        @ColumnsInCreateTable NVARCHAR(MAX),
        @ColumnsInSelectList NVARCHAR(MAX),
		@TableName1 nvarchar(MAX);

		set @TableName1 = cfg.getTempTableName(1);



SELECT @ColumnsInCreateTable = STUFF(
(
    SELECT ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
    FROM STF.Trace
    WHERE CheckInventory = 1
    ORDER BY TraceID
    FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)'), 1   ,1   ,'');

IF (@ColumnsInCreateTable IS NULL)
    SET @ColumnsInCreateTable = '[-1] NVARCHAR(256)';

SET @Query
    = N'create table ' + @TableName1 + '
	(	
		
		StockID int,
		StuffID int,
		'+ @ColumnsInCreateTable + '
		,MainQuantity Decimal(36,10),
		SubQuantity Decimal(36,10)
	) ';

EXEC (@Query);

---Get Stuffs To Be Calculated
begin
SELECT value StuffID into #SelectedStuffs FROM cfg.R_FnCommaStr2Table(@StuffId)

select s.StuffID into #StuffSource from stf.Stuff s
left join #SelectedStuffs ss on  s.StuffID = ss.StuffID
where (@StuffId is null or ss.StuffID is not null)
end


SELECT @ColumnsInSelectList = STUFF(
(
    SELECT ',' + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE CheckInventory = 1
    ORDER BY TraceID
    FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

IF (@ColumnsInSelectList IS NULL)
    SET @ColumnsInSelectList = '[-1]';

---- Fetch Stocks Last Closing Date

SELECT * INTO #LastClosedStockDate
FROM (
SELECT ROW_NUMBER() OVER(PARTITION BY sco.StockID ORDER BY fp.EndDate DESC) rno,
       sco.StockID,
       DATEADD(DAY,1,fp.EndDate) Date,
       fp.FinancialPeriodID
       
FROM   stc.StockClosingOperation  AS sco
       JOIN cfg.FinancialPeriod   AS fp
            ON  fp.FinancialPeriodID = sco.FinancialPeriodID  
			where fp.EndDate<@ToDate
) a 
WHERE a.rno = 1



IF @ColumnsInSelectList <> '[-1]'
    SET @Query = N'insert into ' + @TableName1 + '
					select o.StockID,oi.StuffID,' + @ColumnsInSelectList+ '  ,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity	
					from stc.Outgoing o 
					INNER JOIN stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
					INNER join #StuffSource ss on oi.StuffID = ss.StuffID
					LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
					LEFT JOIN(
								select OutgoingItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
																  When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
																   else Value end Value
								from stc.OutgoingItemTrace ) x
					pivot 
					(
							max(Value)
						for TraceID in ( ' + @ColumnsInSelectList+ ')
					) p on oi.OutgoingItemID = p.OutgoingItemID
					where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
					group by o.StockID,oi.StuffID,' + @ColumnsInSelectList;
ELSE
    SET @Query = N' insert into ' + @TableName1 + '
				    select o.StockID,oi.StuffID,Null as ' + @ColumnsInSelectList+ '  ,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity		 	
					from stc.Outgoing o 
					INNER JOIN stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID	
					INNER join #StuffSource ss on oi.StuffID = ss.StuffID
					LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
					where ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
					group by o.StockID,oi.StuffID';


EXEC sp_executesql @Query, 

				 N'@stockID int,
				   @ToDate Date', 
				   @stockID = @stockID,
				   @ToDate = @ToDate;
				   
IF @ColumnsInSelectList <> '[-1]'
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,' + @ColumnsInSelectList + '  ,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity
					from stc.ReturnStockReceipt o 
					INNER JOIN stc.ReturnStockReceiptItem oi on o.ReturnStockReceiptID = oi.ReturnStockReceiptID
					INNER join #StuffSource ss on oi.StuffID = ss.StuffID
					LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
					LEFT JOIN(
								select ReturnStockReceiptItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
																				When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
																				else Value end Value
								from stc.ReturnStockReceiptItemTrace ) x
					pivot 
					(
							max(Value)
						for TraceID in ( ' + @ColumnsInSelectList+ ')
					) p  on oi.ReturnStockReceiptItemID = p.ReturnStockReceiptItemID
					where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
					group by o.StockID,oi.StuffID,' + @ColumnsInSelectList;
ELSE
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,Null as ' + @ColumnsInSelectList+ '  ,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity
			from stc.ReturnStockReceipt o 
			INNER JOIN stc.ReturnStockReceiptItem oi on o.ReturnStockReceiptID = oi.ReturnStockReceiptID
			INNER join #StuffSource ss on oi.StuffID = ss.StuffID
			LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
			where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
			and (@stockID IS NULL or o.StockID = @stockID)
			group by o.StockID,oi.StuffID';

EXEC sp_executesql @Query, 
				 N'@stockID int,
				   @ToDate Date',
				   @stockID = @stockID,
				   @ToDate = @ToDate;
 
IF @ColumnsInSelectList <> '[-1]'
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,' + @ColumnsInSelectList + '  ,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
			from stc.ReturnedOutgoing o 
			INNER JOIN stc.ReturnedOutgoingItem oi on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
			INNER join #StuffSource ss on oi.StuffID = ss.StuffID
			LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
			LEFT JOIN(
						select ReturnedOutgoingItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
																	When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
																			else Value end Value
						from stc.ReturnedOutgoingItemTrace ) x
			pivot 
			(
					max(Value)
				for TraceID in ( ' + @ColumnsInSelectList + ')
			) p  on oi.ReturnedOutgoingItemID = p.ReturnedOutgoingItemID
			where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
			group by o.StockID,oi.StuffID,' + @ColumnsInSelectList;
ELSE
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,Null as ' + @ColumnsInSelectList+ '  ,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
			from stc.ReturnedOutgoing o 
			INNER JOIN stc.ReturnedOutgoingItem oi on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
			INNER join #StuffSource ss on oi.StuffID = ss.StuffID
			LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
			where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
			group by o.StockID,oi.StuffID';

EXEC sp_executesql @Query, 
				 N'@stockID int,
				   @ToDate Date', 
				   @stockID = @stockID,
				   @ToDate = @ToDate;
 
IF @ColumnsInSelectList <> '[-1]'
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,' + @ColumnsInSelectList+ '  ,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
			from stc.StockReceipt o 
			INNER JOIN stc.StockReceiptItem oi on o.StockReceiptID = oi.StockReceiptID
			INNER join #StuffSource ss on oi.StuffID = ss.StuffID
			LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
			LEFT JOIN(
						select StockReceiptItemID,TraceID,Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
															When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
																	else Value end Value
						from stc.StockReceiptItemTrace ) x
			pivot 
			(
					max(Value)
				for TraceID in ( ' + @ColumnsInSelectList + ')
			) p on oi.StockReceiptItemID = p.StockReceiptItemID
			where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
					and (@stockID IS NULL or o.StockID = @stockID)
			group by o.StockID,oi.StuffID,' + @ColumnsInSelectList;
ELSE
    SET @Query
        = N'insert into ' + @TableName1 + '
			select o.StockID,oi.StuffID,Null as ' + @ColumnsInSelectList+ '  ,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
			from stc.StockReceipt o 
			INNER JOIN stc.StockReceiptItem oi on o.StockReceiptID = oi.StockReceiptID
			INNER join #StuffSource ss on oi.StuffID = ss.StuffID
			LEFT JOIN  #LastClosedStockDate lcsd on o.StockID = lcsd.StockID
			where  ((lcsd.StockID IS NOT NULL
								 AND o.Date >= lcsd.Date
								   )
								OR ( lcsd.StockID IS NULL))
					AND o.Date <= @ToDate 
			and (@stockID IS NULL or o.StockID = @stockID)
			group by o.StockID,oi.StuffID';

EXEC sp_executesql @Query, 
				 N'@stockID int,
				   @ToDate Date', 
				   @stockID = @stockID,
				   @ToDate = @ToDate;
				
 

	select a.PosInvoiceID,a.Date,a.StockID,IsReturnInvoice
	into #FreePosInvoice
	from pos.PosInvoice a
	LEFT JOIN  #LastClosedStockDate lcsd on a.StockID = lcsd.StockID
	where deliverd = 0
	and  ((lcsd.StockID IS NOT NULL AND a.Date >= lcsd.Date)
								OR ( lcsd.StockID IS NULL))
					AND a.Date <= @ToDate 
	and (@stockID IS NULL or a.StockID = @stockID)
	and a.Status = 1

	IF @ColumnsInSelectList <> '[-1]'
		SET @Query
			= N'insert into ' + @TableName1 + '
							SELECT  
									o.StockID ,
									oi.StuffID ,
									' + @ColumnsInSelectList + ',
									sum(case when IsReturnInvoice=0 then -MainQuantity else MainQuantity END) MainQuantity,
									sum(isnull(case when IsReturnInvoice=0 then -SubQuantity else SubQuantity END,0)) SubQuantity							
							FROM    #FreePosInvoice o
									INNER JOIN POS.PosInvoiceItem oi ON oi.PosInvoiceID = o.PosInvoiceID
									INNER join #StuffSource ss on oi.StuffID = ss.StuffID
									INNER JOIN stf.stuff stf on stf.stuffid = oi.stuffid
									LEFT JOIN ( SELECT t.PosInvoiceItemID,
													   t.TraceID,
													   CASE
														   WHEN t.DlID IS NOT NULL THEN
															   CAST(t.DlID AS NVARCHAR(MAX))
														   WHEN t.TraceItemID IS NOT NULL THEN
															   CAST(t.TraceItemID AS NVARCHAR(MAX))
														   ELSE
															   Value
													   END Value
												FROM POS.PosInvoiceItemTrace t
													LEFT JOIN STF.TraceItem AS ti
														ON ti.TraceItemID = t.TraceItemID
											  ) x PIVOT ( MAX(Value) FOR TraceID IN (' + @ColumnsInSelectList + ' ) ) p ON p.PosInvoiceItemID = oi.PosInvoiceItemID
							WHERE stf.type = 0 
				group by o.StockID,oi.StuffID,' + @ColumnsInSelectList;
	ELSE
		SET @Query
			= N'insert into ' + @TableName1 + '
							SELECT  
									o.StockID ,
									oi.StuffID ,
									NULL,
									sum(case when IsReturnInvoice=0 then -MainQuantity else MainQuantity END) MainQuantity,
									sum(isnull(case when IsReturnInvoice=0 then -SubQuantity else SubQuantity END,0)) SubQuantity	
							FROM    #FreePosInvoice o
									INNER JOIN POS.PosInvoiceItem oi ON oi.PosInvoiceID = o.PosInvoiceID
									INNER join #StuffSource ss on oi.StuffID = ss.StuffID
									INNER JOIN stf.stuff stf on stf.stuffid = oi.stuffid
						where stf.type = 0 
							group by o.StockID ,oi.StuffID';

	EXEC sp_executesql @Query, 
					 N'@stockID int', 
					   @stockID = @stockID;

					   

	SET @Query
    = N'
		select '''+cast(@ToDate as nvarchar(50)) +''' Date,StockID,StuffID,' + @ColumnsInSelectList + ',Sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity 
		into   '+@FinalTable + N' from ' + @TableName1 +'
		group by  StockID,StuffID,' + @ColumnsInSelectList 

EXEC (@Query);
END ;
