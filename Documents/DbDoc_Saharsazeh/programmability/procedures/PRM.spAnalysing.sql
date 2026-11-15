-----------------------------------
--spAnalysing.sql:
 

Create       PROCEDURE [PRM].spAnalysing
(
@filter varchar(max),
@filter1 varchar(max) = null,
@FinancialPeriodID int,
@Date Date,
@Type tinyint
)
--WITH ENCRYPTION
AS
BEGIN

	IF OBJECT_ID('T1') IS Not NULL
	DROP TABLE T1

	IF OBJECT_ID('T2') IS Not NULL
	DROP TABLE T2

    DECLARE @Columns NVARCHAR(MAX),
			@Columns1 NVARCHAR(MAX),
			@ColumnsInCreateTable NVARCHAR(MAX),
			@SelectList NVARCHAR(MAX),
            @query NVARCHAR(MAX),            
			@UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
			@selectTrace NVARCHAR(MAX) ,
			@CodeAndTitleColumn NVARCHAR(MAX),
			@CultureNo TINYINT,
			@InventoryTable NVARCHAR(250),
			@PlannedTable NVARCHAR(250),
			@ReservedTable NVARCHAR(250),
			@FiltertableName varchar(max),
			@FiltertableName1 varchar(max),
			@joinColumns varchar(max),
			@joinColumns1 varchar(max),
			@LeftJoin nvarchar(max),
			@listLeftJoin nvarchar(max), 
			@CodeAndTitleSelectList nvarchar(max)

	SET @FiltertableName = CFG.getTempTableName(1);
	SET @FiltertableName1 = CFG.getTempTableName(1);
	SET @InventoryTable = CFG.getTempTableName(1);
	SET @PlannedTable = CFG.getTempTableName(1);
	SET @ReservedTable = CFG.getTempTableName(1);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

			SELECT @Columns = STUFF(
										(
											SELECT ',' + QUOTENAME(TraceID) 
											FROM STF.Trace
											ORDER BY TraceID
											FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,''
								   );

			IF (@Columns IS NULL)
				SET @Columns = N'[-1]';


			SELECT @Columns1 = STUFF(
										(
											SELECT ',' + QUOTENAME(a.TraceID) 
											FROM STF.Trace a
											join stf.TraceDocumentNumType b on a.TraceID = b.TraceID
											join cfg.DocumentNumType c on c.DocumentNumTypeID = b.DocumentNumTypeID
											where CheckInventory = 1
											and c.EngName = 'MaterialAnalysis'
											ORDER BY a.TraceID
											FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,0,''
								   );

			IF (@Columns1 IS NULL)
				set @Columns1 = ''

			SELECT @selectTrace = STUFF(
								  (   SELECT   ', CASE WHEN piv.'
											   + QUOTENAME(t.TraceID)
											   + ' = ''null'' THEN NULL ELSE piv.'
											   + QUOTENAME(t.TraceID) + ' END AS'
											   + QUOTENAME(t.TraceID)
									  FROM     STF.Trace AS t
									  ORDER BY t.TraceID
									  FOR XML PATH('')) ,
								  1 ,
								  1 ,
								  '');
			IF @selectTrace IS NULL
				SET @selectTrace = '[-1]';

			SELECT @joinColumns
				= STUFF(
				  (
					  SELECT ' AND ISNULL(@' + cast(t.TraceID as varchar(15)) + '], 0) = ISNULL(#' + cast(t.TraceID as varchar(15)) + '], 0) '
					  FROM STF.Trace AS t
					  ORDER BY t.TraceID
					  FOR XML PATH('')
				  ),
				  1,
				  0,
				  ''
					   );

			IF @joinColumns IS NULL
				SET @joinColumns = N'AND 1 = 1';	

			SELECT @joinColumns1
				= STUFF(
				  (
					  SELECT ' AND ISNULL(@' + cast(a.TraceID as varchar(15)) + '], 0) = ISNULL(#' + cast(a.TraceID as varchar(15)) + '], 0) '
					FROM STF.Trace a
					join stf.TraceDocumentNumType b on a.TraceID = b.TraceID
					join cfg.DocumentNumType c on c.DocumentNumTypeID = b.DocumentNumTypeID
					where CheckInventory = 1
					and c.EngName = 'MaterialAnalysis'
					  ORDER BY a.TraceID
					  FOR XML PATH('')
				  ),
				  1,
				  0,
				  ''
					   );

			IF @joinColumns1 IS NULL
				SET @joinColumns1 = N'AND 1 = 1';	


			SELECT @SelectList = STUFF(
										(
											SELECT ',@' + cast(TraceID as varchar(15)) + ']'
											FROM STF.Trace
											ORDER BY TraceID
											FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,''
								   );

			IF (@SelectList IS NULL)
				SET @SelectList = N'@-1]';

            SELECT @ColumnsInCreateTable = STUFF(
            (
                SELECT ',[@' + cast(TraceID as varchar(50)) + '] NVARCHAR(256)'
                FROM STF.Trace
                WHERE CheckInventory = 1
				ORDER BY TraceID
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            1   ,
            ''
                                   );

            IF (@ColumnsInCreateTable IS NULL)
                SET @ColumnsInCreateTable = N'[@-1] NVARCHAR(256)';

				exec stc.spGetInventoryInDate
				 @StuffId  =   null,
				 @stockID =    Null,
				 @ToDate =	  @Date,
				 @FinalTable = @InventoryTable





            SELECT @ColumnsInCreateTable = STUFF(
            (
                SELECT ',[@' + cast(TraceID as varchar(50)) + '] NVARCHAR(256)'
                FROM STF.Trace
				ORDER BY TraceID
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            1   ,
            ''
                                   );

            IF (@ColumnsInCreateTable IS NULL)
                SET @ColumnsInCreateTable = N'[@-1] NVARCHAR(256)';
            SET @Query
                = N'Create table ' + @PlannedTable + '
				(	StuffID int
					,[Date]	Date
					,'+ REPLACE(@ColumnsInCreateTable ,'@','') + '
					,Planned Decimal(30,4)
				) ';

			
            EXEC (@Query);
		
            SET @Query
                = N'insert into ' + @PlannedTable + N'
					SELECT  stuffid,pp.Date,'+@Columns+',Planned
					FROM    
					(select sri.ProductionPlanningID,sri.ProductionPlanningItemID,sri.stuffid,SUM(sri.MainQuantity) - ISNULL(SUM(oi.MainQuantity), 0)  - ISNULL(SUM(pdi.MainQuantity), 0) Planned
					from prm.ProductionPlanningItem AS sri
					LEFT JOIN STC.StockReceiptItem AS oi ON oi.ProductionPlanningItemID = sri.ProductionPlanningItemID
					LEFT JOIN prm.ProductionDeliveryItem AS pdi ON pdi.ProductionPlanningItemID = sri.ProductionPlanningItemID
					group by sri.ProductionPlanningID,sri.ProductionPlanningItemID,sri.stuffid
					) sri
					join prm.ProductionPlanning pp on pp.ProductionPlanningID = sri.ProductionPlanningID
					LEFT JOIN
					(select  ProductionPlanningItemID,b.TraceID,
							case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  								 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
								 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
								 else Value end value
					from prm.ProductionPlanningItemTrace b
					left join stf.trace c on c.traceid = b.traceid
					)x
					pivot
					(
						max(value)
						for traceid in (' + @Columns + ')		
					) ii on ii.ProductionPlanningItemID = sri.ProductionPlanningItemID
							'
			EXEC (@Query);
            SET @Query
                = N'Create table ' + @ReservedTable + '
				(	StuffID int
					,[Date]	Date
					,'+ REPLACE(@ColumnsInCreateTable ,'@','') + '
					,Reserved Decimal(30,4)
				) ';

			
            EXEC (@Query);

            SET @Query
                = N'insert into ' + @ReservedTable + N'
					SELECT  stuffid,pp.StuffRequestDate,'+@Columns+', Reserved
					FROM    
					(
					SELECT   sri.StuffRequestID,sri.StuffRequestItemID ,sri.stuffid,sum(Non) Reserved
					FROM     REQ.StuffRequestItem AS sri
					LEFT JOIN req.StuffRequest_Remains AS srr ON srr.StuffRequestItemID = sri.StuffRequestItemID
					group by sri.StuffRequestID,sri.StuffRequestItemID ,sri.stuffid
					) sri
					join  REQ.StuffRequest pp on pp.StuffRequestID = sri.StuffRequestID
					LEFT JOIN
					(select  StuffRequestItemID,b.TraceID,
							case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  								 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
								 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
								 else Value end value
					from REQ.StuffRequestItemTrace b
					left join stf.trace c on c.traceid = b.traceid
					)x
					pivot
					(
						max(value)
						for traceid in (' + @Columns + ')		
					) ii on ii.StuffRequestItemID = sri.StuffRequestItemID
							'
			EXEC (@Query);

					
			
		SELECT ROW_NUMBER() OVER ( ORDER BY t.TraceID ) rn ,
				   t.TraceID ,
				   t.Title
			INTO   #traces
			FROM   STF.Trace AS t;


			SET @query = '	  
					SELECT piv.StuffID,piv.ProductionFormulaItemID ,piv.IndefiniteInventory,piv.Adjustment,piv.Quantity,CostCenterID,' + @selectTrace + '
								 into ' + @FiltertableName + '
					FROM   (  
					SELECT a.Position ,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 1, ''^'') StuffID ,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 2, ''^'') ProductionFormulaItemID,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 3, ''^'') Quantity,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 4, ''^'') Adjustment,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 5, ''^'') IndefiniteInventory,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 6, ''^'') CostCenterID,
									  t.TraceID ,
									  rfcst.value
							   FROM   CFG.R_FnStr2TableBySplitor(@filter, ''|'') a
									  OUTER APPLY CFG.R_FnCommaStr2Table(
													  CFG.GetStringPartBySpliter(a.VALUE, 2, ''#'')) AS rfcst
									  LEFT JOIN #traces AS t ON t.rn = rfcst.Position ) a
					PIVOT (   MAX(value)
							  FOR TraceID IN ( ' + @Columns + ' )
							) piv
				  ';		

			EXEC sp_executesql @query ,
							   N'@filter nvarchar(max)' ,
							   @filter = @filter;
			

			SET @query = '	  
					SELECT piv.StuffID ,piv.IndefiniteInventory,piv.Adjustment,piv.Quantity,CostCenterID,' + @selectTrace + '
								 into ' + @FiltertableName1+ '
					FROM   (  
					SELECT a.Position ,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 1, ''^'') StuffID ,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 2, ''^'') Quantity,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 3, ''^'') Adjustment,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 4, ''^'') IndefiniteInventory,
									  CFG.GetStringPartBySpliter(CFG.GetStringPartBySpliter(a.VALUE, 1, ''#''), 5, ''^'')  CostCenterID,
									  t.TraceID ,
									  rfcst.value
							   FROM   CFG.R_FnStr2TableBySplitor(@filter1, ''|'') a
									  OUTER APPLY CFG.R_FnCommaStr2Table(
													  CFG.GetStringPartBySpliter(a.VALUE, 2, ''#'')) AS rfcst
									  LEFT JOIN #traces AS t ON t.rn = rfcst.Position ) a
					PIVOT (   MAX(value)
							  FOR TraceID IN ( ' + @Columns + ' )
							  ) piv
				  ';
		
		
			EXEC sp_executesql @query ,
							   N'@filter1 nvarchar(max)' ,
							   @filter1 = @filter1;			


			SET @query = '	
			update '+@FiltertableName+' set ProductionFormulaItemID = null where ProductionFormulaItemID = ''null''
			'
			exec(@query)
				
			SET @query = '	
					Create table T1
					(
					ID int IDENTITY(1,1),
					ParentID int,
					S_StuffID int,
					'+REPLACE(@ColumnsInCreateTable ,'@','S_')+'
					,T_StuffID int,
					'+REPLACE(@ColumnsInCreateTable ,'@','T_')+'
					,IndefiniteInventory decimal(30,4)
					,Adjustment decimal(30,4)
					,Quantity decimal(30,4)
					,Status varchar(10)
					,Level int
					,CostCenterID int
					)'
		
						exec(@query)
		
		   SET @query = '	
					Create table T2
					(
					ParentID int,
					StuffID int,
					'+REPLACE(@ColumnsInCreateTable ,'@','')+'
					,Quantity decimal(30,4)
					,CostCenterID int
					)
					'
					exec(@query)


			SET @query = '	
					insert into T1
					select  null
							,StuffID
							,'+REPLACE(@SelectList ,'@','Z.[')+'
							, StuffID
							,'+REPLACE(@SelectList ,'@','Z.[')+'
							,IndefiniteInventory
							,Adjustment
							,Quantity
							,''old''
							,0
							,CostCenterID
					from '+@FiltertableName1+' z
					'
		  exec(@query)

 

			SET @query = '	
					insert into T1
					select  null
							,z.StuffID
							,'+REPLACE(@SelectList ,'@','Z.[')+'
							,c.StuffID
							,'+REPLACE(@SelectList ,'@','c.[')+'
							,IndefiniteInventory
							,Adjustment
							,z.Quantity * c.Quantity / ii.Quantity
							,''new''
							,1
							,isnull(d.CostCenterID,z.CostCenterID)
					from '+@FiltertableName+' z				
				join 
				(select  a.ProductionFormulaID,a.stuffid,a.Quantity,b.TraceID,
						case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  							 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
							 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
							 else Value end value
				from prm.ProductionFormula a
				left join prm.ProductionFormulaTrace b
					on a.ProductionFormulaID = b.ProductionFormulaID
				left join stf.trace c on c.traceid = b.traceid
				)x
				pivot
				(
					max(value)
					for traceid in (' + @Columns + ')		
				) ii
					on z.StuffID = ii.stuffid ' + REPLACE(REPLACE(@joinColumns,'@','Z.['),'#','ii.[') + '
				join prm.ProductionFormulaItem b 
					on ii.ProductionFormulaID = b.ProductionFormulaID
					and (
							(z.ProductionFormulaItemID is not null and isnull(z.ProductionFormulaItemID,0) = b.ProductionFormulaItemID)
							or
							(z.ProductionFormulaItemID is null and b.ismain = 1)
						)
				join 
				(select  a.ProductionFormulaItemMaterialID,a.ProductionFormulaItemID,a.stuffid,a.Quantity,b.TraceID,
						case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  							 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
							 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
							 else Value end value
				from prm.ProductionFormulaItemMaterial a
				left join prm.ProductionFormulaItemMaterialTrace b
					on a.ProductionFormulaItemMaterialID = b.ProductionFormulaItemMaterialID
				left join stf.trace c on c.traceid = b.traceid
				where NeedAnalysis = 1
				)x
				pivot
				(
					max(value)
					for traceid in (' + @Columns + ')		
				) c
						on b.ProductionFormulaItemID = c.ProductionFormulaItemID
			left join 
			(select *,row_number() over(partition by stuffid,' + @Columns + ' order by ProductionTimingID) Rno
				from
				(select a.ProductionTimingID,a.stuffid,a.CostCenterID,b.TraceID,
						case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  							 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
							 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
							 else Value end value
				from prm.ProductionTiming a
				left join prm.ProductionTimingTrace b
					on a.ProductionTimingID = b.ProductionTimingID
				left join stf.trace c on c.traceid = b.traceid
				)x
				pivot
				(
					max(value)
					for traceid in (' + @Columns + ')		
				)piv
			)d
						on d.Rno = 1 and  c.StuffID = d.stuffid ' + REPLACE(REPLACE(@joinColumns,'@','c.['),'#','d.[') + '
		  '
			EXEC sp_executesql @query ,
							   N'@Date Date' ,
							   @Date = @Date
			  SET @query = '	
					  insert into T2
					  select oi.ID							
							,T_StuffID
							,'+REPLACE(@SelectList ,'@','[T_')+'
							,case when  Quantity > isnull(Inventory.MainQuantity , 0 ) + isnull(Planned , 0 )  - isnull(Reserved , 0 )  
										then Quantity - isnull(Inventory.MainQuantity , 0 ) - isnull(Planned , 0 )  + isnull(Reserved , 0 )  
										else 0 end
							,oi.CostCenterID
					  from T1 oi			 
						left join '+@InventoryTable+' Inventory
							on Inventory.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns1,'@','oi.[T_'),'#','Inventory.[')+'
						left join 
						(
						select StuffID,sum(Planned) Planned,'+@Columns+'
						from '+@PlannedTable+'
						where date <= @Date
						group by StuffID,'+@Columns+'
						)Planned
							on Planned.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Planned.[')+'
						left join 
						(
						select StuffID,sum(Reserved) Reserved,'+@Columns+'
						from '+@ReservedTable+'
						where date <= @Date
						group by StuffID,'+@Columns+'
						)Reserved
							on Reserved.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Reserved.[')+'
					  where Status = ''new''
					 and isnull(Inventory.MainQuantity , 0 )  + isnull(Planned , 0 )  - isnull(Reserved , 0 )  < oi.Quantity
					  '
			
			EXEC sp_executesql @query ,
							   N'@Date Date' ,
							   @Date = @Date
		declare @Level int = 1

		WHILE exists (select * from  T2)
			BEGIN  

			set @Level = @Level + 1

			update T1
			set Status = 'old'

			  SET @query = '		
					insert into T1
					select  z.ParentID
							,z.StuffID
							,'+REPLACE(@SelectList ,'@','Z.[')+'
							,c.StuffID
							,'+REPLACE(@SelectList ,'@','c.[')+'
							,0
							,0
							,z.Quantity * c.Quantity / ii.Quantity 
							,''new''
							,@Level
							,isnull(d.CostCenterID,z.CostCenterID)
					from T2 z				
				join 
				(select  a.ProductionFormulaID,a.stuffid,a.Quantity,b.TraceID,
						case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  							 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
							 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
							 else Value end value
				from prm.ProductionFormula a
				left join prm.ProductionFormulaTrace b
					on a.ProductionFormulaID = b.ProductionFormulaID
				left join stf.trace c on c.traceid = b.traceid
				)x
				pivot
				(
					max(value)
					for traceid in (' + @Columns + ')		
				) ii
					on z.StuffID = ii.stuffid ' + REPLACE(REPLACE(@joinColumns,'@','Z.['),'#','ii.[') + '
					join prm.ProductionFormulaItem b 
						on ii.ProductionFormulaID = b.ProductionFormulaID
				join 
				(select  a.ProductionFormulaItemMaterialID,a.ProductionFormulaItemID,a.stuffid,a.Quantity,b.TraceID,
						case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  							 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
							 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
							 else Value end value
				from prm.ProductionFormulaItemMaterial a
				left join prm.ProductionFormulaItemMaterialTrace b
					on a.ProductionFormulaItemMaterialID = b.ProductionFormulaItemMaterialID
				left join stf.trace c on c.traceid = b.traceid
				where NeedAnalysis = 1
				)x
				pivot
				(
					max(value)
					for traceid in (' + @Columns + ')		
				) c
						on b.ProductionFormulaItemID = c.ProductionFormulaItemID
				left join 
				(select *,row_number() over(partition by stuffid,' + @Columns + ' order by ProductionTimingID) Rno
					from
					(select a.ProductionTimingID,a.stuffid,a.CostCenterID,b.TraceID,
							case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  								 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
								 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
								 else Value end value
					from prm.ProductionTiming a
					left join prm.ProductionTimingTrace b
						on a.ProductionTimingID = b.ProductionTimingID
					left join stf.trace c on c.traceid = b.traceid
					)x
					pivot
					(
						max(value)
						for traceid in (' + @Columns + ')		
					)piv
				)d
						on d.Rno = 1 and  c.StuffID = d.stuffid ' + REPLACE(REPLACE(@joinColumns,'@','c.['),'#','d.[') + '
				left join T1 on T1.S_Stuffid = ii.Stuffid  ' + REPLACE(REPLACE(@joinColumns,'@','t1.[S_'),'#','ii.[') + '
							 and T1.T_StuffID = c.stuffid  ' + REPLACE(REPLACE(@joinColumns,'@','t1.[T_'),'#','c.[') + '
				where T1.S_stuffid is null
						'
				   
				
			EXEC sp_executesql @query ,
							   N'@Date Date,@Level int' ,
							   @Date = @Date,@Level = @Level
							   
			  delete from T2

		
			  SET @query = '	
					  insert into T2
					  select oi.ID,T_StuffID,
							'+REPLACE(@SelectList ,'@','[T_')+'
							,case when  Quantity > isnull(Inventory.MainQuantity , 0 ) + isnull(Planned , 0 )  - isnull(Reserved , 0 )  
										then Quantity - isnull(Inventory.MainQuantity , 0 ) - isnull(Planned , 0 )  + isnull(Reserved , 0 )  
										else 0 end		
							,oi.CostCenterID
					  from T1 oi
						left join '+@InventoryTable+' Inventory
							on Inventory.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns1,'@','oi.[T_'),'#','Inventory.[')+'
						left join 
						(
						select StuffID,sum(Planned) Planned,'+@Columns+'
						from '+@PlannedTable+'
						where date <= @Date
						group by StuffID,'+@Columns+'
						)Planned
							on Planned.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Planned.[')+'
						left join 
						(
						select StuffID,sum(Reserved) Reserved,'+@Columns+'
						from '+@ReservedTable+'
						where date <= @Date
						group by StuffID,'+@Columns+'
						)Reserved
							on Reserved.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Reserved.[')+'
					  where Status = ''new''
					  and isnull(Inventory.MainQuantity,0)  + isnull(Planned , 0 )  - isnull(Reserved , 0 )  < oi.Quantity
					  '
			  
			EXEC sp_executesql @query ,
							   N'@Date Date' ,
							   @Date = @Date
			 	

			END   
		
		
		SELECT @CodeAndTitleColumn
			= STUFF(
		(
			SELECT DISTINCT
				   ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [T' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
				   + CAST(TraceID AS VARCHAR(10)) + '.Title [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
			FROM STF.Trace
			WHERE DlTypeID IS NOT NULL
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		0  ,
		''
				   );

		IF (@CodeAndTitleColumn IS NULL)
			SET @CodeAndTitleColumn = N'';


			

		SELECT @LeftJoin
			= STUFF(
		(
			SELECT DISTINCT
				   ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
				   + '.DlID = oi.T_' + CAST(TraceID  AS VARCHAR(10))
			FROM STF.Trace
			WHERE DlTypeID IS NOT NULL
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
				   );

		IF (@LeftJoin IS NULL)
			SET @LeftJoin = N'';



		SELECT @listLeftJoin
			= STUFF(
		(
			SELECT DISTINCT
				   ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
				   + '.TraceItemID = oi.T_' + CAST(TraceID  AS VARCHAR(10))
			FROM STF.Trace
			WHERE AccountLevelTypeID = 6
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		1   ,
		''
				   );

		IF (@listLeftJoin IS NULL)
			SET @listLeftJoin = N'';


	
		SELECT @CodeAndTitleSelectList
			= STUFF(
		(
			SELECT DISTINCT
				   ',oi.T_' + CAST(TraceID AS VARCHAR(10)) + ' AS TR' + CAST(TraceID AS NVARCHAR(5))
				   + CASE
						 WHEN AccountLevelTypeID = 6 THEN
							 ',d' + CAST(TraceID AS VARCHAR(10)) + '.Item' + CASE
																				 WHEN @CultureNo = 2 THEN
																					 '2'
																				 ELSE
																					 ''
																			 END + ' AS TRCode' + CAST(TraceID AS NVARCHAR(5))
						 ELSE
							 ''
					 END
			FROM STF.Trace
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1   ,
		0   ,
		''
				   );

		IF (@CodeAndTitleSelectList IS NULL)
			SET @CodeAndTitleSelectList = N'';
	
		set @query = N'
		select  '+
				case when @Type = 1 then N'Row_Number() over(order by oi.Level)  RowIndex,'
					 when @Type = 2 then N'Rank() over(order by T_StuffID,'+REPLACE(@SelectList ,'@','[T_')+') RowIndex,'
				end
				+N'				
				stuff.StuffID,
				stuff.Code StuffCode,
				stuff.Title StuffTitle,
				oi.CostCenterId,
				cc.title CostCenterTitle,
				oi.Quantity RequiredQuantity,
				isnull(Inventory.MainQuantity , 0)  DefiniteInventory,
				isnull(Planned , 0 )  Planned,
				isnull(Reserved , 0 ) Reserved,
				IndefiniteInventory,
				case when isnull(Inventory.MainQuantity , 0) + isnull(Planned , 0 ) - isnull(Reserved , 0 )  + IndefiniteInventory > oi.Quantity  then 0 else oi.Quantity - isnull(Inventory.MainQuantity , 0) -  isnull(Planned , 0 ) + isnull(Reserved , 0 )- IndefiniteInventory end Shortage,
				Adjustment,
				case when isnull(Inventory.MainQuantity , 0) + isnull(Planned , 0 ) - isnull(Reserved , 0 )  + IndefiniteInventory > oi.Quantity + Adjustment  then 0 else oi.Quantity + Adjustment - isnull(Inventory.MainQuantity , 0)-  isnull(Planned , 0 ) + isnull(Reserved , 0 ) - IndefiniteInventory end  ProductionOrder
				' + @CodeAndTitleSelectList + '
				' + @CodeAndTitleColumn + '
		from 
		(	
		select T_StuffID,CostCenterID,sum(Quantity) Quantity,sum(IndefiniteInventory) IndefiniteInventory,sum(Adjustment) Adjustment,Max(Level) Level,'+REPLACE(@SelectList ,'@','[T_')+'
		from T1 
		where Quantity > 0
		group by T_StuffID,CostCenterID,'+REPLACE(@SelectList ,'@','[T_')+'
		)oi
		join cfg.CostCenter cc on cc.CostCenterID = oi.CostCenterID
		join stf.stuff on stuff.StuffID = oi.T_StuffID
		join stf.stuffdetail sd on sd.StuffID =  stuff.StuffID
		join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
		' + @LeftJoin + N' ' + @listLeftJoin+'
		left join '+@InventoryTable+' Inventory
			on Inventory.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns1,'@','oi.[T_'),'#','Inventory.[')+'
		left join 
		(
		select StuffID,sum(Planned) Planned,'+@Columns+'
		from '+@PlannedTable+'
		where date <= @Date
		group by StuffID,'+@Columns+'
		)Planned
			on Planned.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Planned.[')+'
		left join 
		(
		select StuffID,sum(Reserved) Reserved,'+@Columns+'
		from '+@ReservedTable+'
		where date <= @Date
		group by StuffID,'+@Columns+'
		)Reserved
			on Reserved.StuffID = oi.T_StuffID '+REPLACE(REPLACE(@joinColumns,'@','oi.[T_'),'#','Reserved.[')+'
		where
		((@Type = 1 and  sag.stuffdetailtype in (1,2))
		or
		 (@Type = 2 and  sag.stuffdetailtype = 0)
		 )

		'
--Print @query

    EXEC sp_executesql @query ,
                       N'@Date Date,@Type tinyint' ,
                       @Date = @Date,
					   @Type = @Type;



end
 
