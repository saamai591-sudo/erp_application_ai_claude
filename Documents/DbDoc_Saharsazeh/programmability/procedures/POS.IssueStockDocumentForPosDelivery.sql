
CREATE   PROC [POS].IssueStockDocumentForPosDelivery
(
	@DeliveryId int,
	@Date date
)
as
    DECLARE @FinalStuffInventoryErrors NVARCHAR(MAX),@FinalStuffInventoryErrors1 NVARCHAR(MAX) ,
	@OutgoingID int ,
	@ReturnedOutgoingID int 
	set @FinalStuffInventoryErrors = cfg.getTempTableName(1)
	set @FinalStuffInventoryErrors1 = cfg.getTempTableName(1)
	
    CREATE TABLE  #error  (
    [Message] NVARCHAR(MAX) ,
    IsDetail BIT )

declare @ErrorMessage NVARCHAR(4000),
		@ErrorSeverity INT,
		@ErrorState INT
DECLARE @LastEditor int = [CFG].[GetuserID]()
DECLARE @LastEditionDate datetime = GETDATE()

	select  pii.PosInvoiceItemID,
			pii.StuffID, 
			pii.MainQuantity,
			pii.SubQuantity,
			pi.IsReturnInvoice
	into #TempStuffs
	from pos.DeliveryPosInvoice dpi
	join pos.PosInvoice pi on pi.PosInvoiceID = dpi.PosInvoiceID
	join pos.PosInvoiceItem pii on pii.PosInvoiceID = pi.PosInvoiceID
	join stf.stuff s on s.StuffID = pii.StuffID
	where DeliveryID = @DeliveryId
	and s.Type = 0

	if exists (select 1 from #TempStuffs)
	begin

		DECLARE @StockDocumentTypeBaseEntityID int 

		SELECt top 1 @StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		from stc.StockDocumentType sdt
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		where type = 2
		and DocumentType = 17

		if @StockDocumentTypeBaseEntityID is null
		begin		
			INSERT INTO #error values('StoreSale.Messages.StockDocumentTypeByStoreSaleNatureIsNotDefined',0);
				
			SELECT * FROM #error
			RETURN;
		end
		 
		DECLARE @StockID int 
		DECLARE @DeliverDlID bigint
		DECLARE @FinancialPeriodID int

		select top 1 @StockID = s.StockID,
					 @DeliverDlID = s.DlID,
					 @FinancialPeriodID = d.FinancialPeriodID
		from pos.Delivery d
		join pos.StationShift ss on d.StationShiftID = ss.StationShiftID
		join pos.Station s on s.StationID = ss.StationID
		where d.DeliveryID = @DeliveryId

		DECLARE @Creator int = [CFG].[GetuserID]()
		DECLARE @CreationDate datetime = GETDATE()

		DECLARE @Query NVARCHAR(MAX),
				@Columns NVARCHAR(MAX)

		SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
								   FROM   stf.Trace  al                
								   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
		IF(@Columns is null)								   
			SET @Columns = '[-1]'	

		DECLARE @TableName1 NVARCHAR(MAX)
		DECLARE @TableName2 NVARCHAR(MAX)
		DECLARE @TableName3 NVARCHAR(MAX)

		SET @TableName1 = CFG.getTempTableName(1);
		SET @TableName2 = CFG.getTempTableName(1);
		SET @TableName3 = CFG.getTempTableName(1);


		set @Query = N'
		select StuffID,IsReturnInvoice,' + @Columns + ',SUM(MainQuantity) MainQuantity,SUM(SubQuantity) SubQuantity
		into '+@TableName1+'
		from
		(
			select  a.*,
					piit.Traceid,
					Case When piit.DLID IS NOT NULL THEN cast (piit.DLID as nvarchar(max)) 
						 When piit.TraceItemID IS NOT NULL THEN cast (piit.TraceItemID as nvarchar(max))
					ELSE piit.Value end Value
			from #TempStuffs a
			left join pos.PosInvoiceItemTrace piit on piit.PosInvoiceItemID = a.PosInvoiceItemID
		)x
		pivot
		(
		MAX(Value)
		FOR TraceID in (' + @Columns + ')		
		)p
		group by StuffID,IsReturnInvoice,' + @Columns + '
		'
		EXECUTE sp_executesql @Query

		Declare @MaxReturnedOutgoingItemID int
		select @MaxReturnedOutgoingItemID = MAX(ReturnedOutgoingItemID)
		from stc.ReturnedOutgoingItem
		
        SET @Query = N'
		select  ROW_NUMBER() over(order by StuffID) + isnull(@MaxReturnedOutgoingItemID,0) ID,
				*
		into '+@TableName3+'
		from '+@TableName1+'
		where IsReturnInvoice = 1
		'
        EXECUTE sp_executesql @Query, N'@MaxReturnedOutgoingItemID int', @MaxReturnedOutgoingItemID = @MaxReturnedOutgoingItemID;


		Declare @HasReturnedOutgoing Bit
		set @Query = N'if exists (select 1 from '+@TableName3+') set @HasReturnedOutgoing = 1'
		EXECUTE sp_executesql @Query,N'@HasReturnedOutgoing bit out',@HasReturnedOutgoing = @HasReturnedOutgoing out

		if @HasReturnedOutgoing = 1
		begin

			create table #ReturnedOutgoingInsertResult
			(
				ReturnedOutgoingID int,
				Number	int,
				Version int
			)

			insert into #ReturnedOutgoingInsertResult
			EXECUTE  [STC].[spReturnedOutgoingInsert] 
			   @FinancialPeriodID
			  ,@StockDocumentTypeBaseEntityID
			  ,@StockID
			  ,@DeliverDlID --@DeliverDlID
			  ,NULL --@StockDeliverID
			  ,NULL --@Number
			  ,@Date
			  ,NULL --@ReturnStockReceiptID
			  ,NULL --@PreVoucherID
			  ,@Creator
			  ,@CreationDate
			  ,@Creator --@LastEditor
			  ,@CreationDate --@LastEditionDate
			  ,0 --@TotalPrice
			  
			SELECT TOP 1 @ReturnedOutgoingID = [ReturnedOutgoingID] from #ReturnedOutgoingInsertResult

			SET @Query = N'
			set identity_insert  [STC].[ReturnedOutgoingItem] on
			INSERT INTO [STC].[ReturnedOutgoingItem]
			  ([ReturnedOutgoingItemID],
			   [ReturnedOutgoingID], 
			   [RowIndex], 
			   [OutgoingItemID], 
			   [StuffID], 
			   [MainQuantity], 
			   [SubQuantity], 
			   [Fee], 
			   [Price], 
			   [Description], 
			   [Description2], 
			   [Version], 
			   [Creator], 
			   [CreationDate], 
			   [LastEditor], 
			   [LastEditionDate],
			   [ReturnedSaleInvoiceItemID]
			  )
			  select 
				ID,
				@ReturnedOutgoingID,
				ROW_NUMBER() over(order by StuffID),
				NULL,
				[StuffID],
				[MainQuantity],
				[SubQuantity],
				0,
				0,
				NULL,
				NULL,
				0,
				@Creator,
				@CreationDate,
				@Creator,
				@CreationDate,
				NULL
			  from '+@TableName3+'
			  set identity_insert  [STC].[ReturnedOutgoingItem] off
			  '
			EXECUTE sp_executesql @Query,
								N'@ReturnedOutgoingID int,
								  @Creator int,
								  @CreationDate DateTime',
								  @ReturnedOutgoingID = @ReturnedOutgoingID,
								  @Creator = @Creator,
								  @CreationDate = @CreationDate

			SET @Query = N'
			INSERT INTO [STC].[ReturnedOutgoingItemTrace]
				   ([ReturnedOutgoingItemID]
				   ,[TraceID]
				   ,[DlID]
				   ,[Value]
				   ,[Version]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[TraceItemID] )
				select [ID]
					   ,a.[TraceID]
					   ,Case when T.AccountLevelTypeID = 1 then Value Else Null End
					   ,Case when T.AccountLevelTypeID <> 1 AND T.AccountLevelTypeID <> 6 then Value Else Null End
					   , 0
					   ,@pCreator
					   ,GETDATE()
					   ,@pCreator
					   ,GETDATE()
					   ,Case when T.AccountLevelTypeID =6 then Value Else Null End
				from  			
				( select ID,' + @Columns + N' from '+@TableName3+' )x
				UNPIVOT
				(
				Value For TraceID  IN (' + @Columns + N')
				)A			
				join stf.Trace T on T.TraceID = a.TraceID';
			EXECUTE sp_executesql @Query, N'@pCreator int', @pCreator = @Creator;



		end

		Declare @MaxOutgoingItemID int
		select @MaxOutgoingItemID = MAX(OutgoingItemID)
		from stc.OutgoingItem

		set @Query = N'
		select  ROW_NUMBER() over(order by StuffID) + isnull(@MaxOutgoingItemID,0) ID,
				*
		into '+@TableName2+'
		from '+@TableName1+'
		where IsReturnInvoice = 0
		'
		EXECUTE sp_executesql @Query, N'@MaxOutgoingItemID int', @MaxOutgoingItemID = @MaxOutgoingItemID;

		Declare @HasOutgoing Bit
		set @Query = N'if exists (select 1 from '+@TableName2+') set @HasOutgoing = 1'
		EXECUTE sp_executesql @Query,N'@HasOutgoing bit out',@HasOutgoing = @HasOutgoing out

		if @HasOutgoing = 1
		begin

			create table #OutgoingInsertResult
			(
			OutgoingID int,
			Number	int,
			Version int
			)
		
			insert into #OutgoingInsertResult
			EXECUTE [STC].[spOutgoingInsert] 
						   1 --@AutoGenerated
						  ,@StockDocumentTypeBaseEntityID
						  ,NULL --@Number
						  ,@Date
						  ,@StockID
						  ,@DeliverDlID
						  ,NULL --@DeliverStockID
						  ,@FinancialPeriodID
						  ,NULL --@PreVoucherID
						  ,@Creator
						  ,@CreationDate
						  ,0 --@TotalPrice

			SELECT TOP 1 @OutgoingID = [OutgoingID] from #OutgoingInsertResult

			set @Query = N'
			SET IDENTITY_INSERT  [STC].[OutgoingItem] on
			INSERT INTO [STC].[OutgoingItem]
			  ( [OutgoingItemID],
				[OutgoingID],
				[RowIndex],
				[JustificationItemID],
				[QuotationItemID],
				[InvoiceItemID],
				[RemittanceItemID],
				[StuffRequestItemID],
				[StuffID],
				[MainQuantity],
				[SubQuantity],
				[Fee],
				[Price],
				[Description],
				[Description2],
				[SaleContractItemID],
				[Version],
				[Creator],
				[CreationDate],
				[LastEditor],
				[LastEditionDate],
				[TemporaryOutgoingItemID],
				[ReceptionID],
				[StuffCompositionID]
			  )
			  select 
				ID,
				@OutgoingID,
				ROW_NUMBER() over(order by StuffID),
				NULL,
				NULL,
				NULL,
				NULL,
				NULL,
				[StuffID],
				[MainQuantity],
				[SubQuantity],
				0,
				0,
				NULL,
				NULL,
				NULL,
				0,
				@Creator,
				@CreationDate,
				@Creator,
				@CreationDate,
				NULL,
				NULL,
				NULL
			  from '+@TableName2+'
			SET IDENTITY_INSERT  [STC].[OutgoingItem] off
			'
			EXECUTE sp_executesql @Query,
								N'@OutgoingID int,
								  @Creator int,
								  @CreationDate DateTime',
								  @OutgoingID = @OutgoingID,
								  @Creator = @Creator,
								  @CreationDate = @CreationDate

			SET @Query = N'
			INSERT INTO [STC].[OutgoingItemTrace]
				   ([OutgoingItemID]
				   ,[TraceID]
				   ,[DlID]
				   ,[Value]
				   ,[Version]
				   ,[Creator]
				   ,[CreationDate]
				   ,[LastEditor]
				   ,[LastEditionDate]
				   ,[TraceItemID] )
				select [ID]
					   ,a.[TraceID]
					   ,Case when T.AccountLevelTypeID = 1 then Value Else Null End
					   ,Case when T.AccountLevelTypeID <> 1 AND T.AccountLevelTypeID <> 6 then Value Else Null End
					   , 0
					   ,@pCreator
					   ,GETDATE()
					   ,@pCreator
					   ,GETDATE()
					   ,Case when T.AccountLevelTypeID =6 then Value Else Null End
				from  			
				( select ID,' + @Columns + N' from '+@TableName2+' )x
				UNPIVOT
				(
				Value For TraceID  IN (' + @Columns + N')
				)A			
				join stf.Trace T on T.TraceID = a.TraceID';
			EXECUTE sp_executesql @Query, N'@pCreator int', @pCreator = @Creator;

		end

		update pos.Delivery
		set OutgoingID = @OutgoingID,
			ReturnedOutgoingID = @ReturnedOutgoingID,
			[Status] = 2,
			LastEditor=@LastEditor,
			LastEditionDate=@LastEditionDate
		where DeliveryID = @DeliveryId

		update pi 
		set deliverd = 1
		from pos.PosInvoice pi
		join pos.DeliveryPosInvoice dpi on pi.PosInvoiceID = dpi.PosInvoiceID
		WHERE dpi.DeliveryID = @DeliveryId
		--Validation
		if @HasReturnedOutgoing = 1
		begin

		DECLARE @ReturnedOutgoingItemIds NVARCHAR(MAX);
		SELECT @ReturnedOutgoingItemIds = STUFF(
		(
			SELECT ',' + CAST(ReturnedOutgoingItemID AS NVARCHAR(20))
			FROM STC.ReturnedOutgoingItem oi
			JOIN STC.ReturnedOutgoing o
				ON o.ReturnedOutgoingID = oi.ReturnedOutgoingID
			WHERE o.ReturnedOutgoingID = @ReturnedOutgoingId
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	
							EXEC stc.SpFinalStuffInventory
							@ID = Null,
							@EntityName = 'ReturnedOutgoing',
							@Confirmed = 1,
							@IsDeleteOperation = 0,
							@HeaderIDs = @OutgoingID,
							@ControlType = 0,
							@RecountingInvetoryID = null,
							@InventoryEditionID = null,
							@ErrorTable = @FinalStuffInventoryErrors
					
							EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors)		

							IF EXISTS(SELECT 1 FROM #error)
							BEGIN
								SELECT * FROM #error
								RETURN 
							END 

		if @HasOutgoing = 1
		begin
		DECLARE @OutgoingItemIds NVARCHAR(MAX);
		SELECT @OutgoingItemIds = STUFF(
		(
			SELECT ',' + CAST(OutgoingItemID AS NVARCHAR(20))
			FROM STC.OutgoingItem oi
			JOIN STC.Outgoing o
				ON o.OutgoingID = oi.OutgoingID
			WHERE o.OutgoingID = @OutgoingId
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

			EXEC stc.SpFinalStuffInventory
						@ID = null,
						@EntityName = 'Outgoing',
						@Confirmed = 0,
						@IsDeleteOperation = 1,
						@HeaderIDs = @OutgoingID,
						@ControlType = 0,
						@RecountingInvetoryID = null,
						@InventoryEditionID = null,
						@ErrorTable = @FinalStuffInventoryErrors1
					
			EXEC (N'insert into #error select * from '+@FinalStuffInventoryErrors1)	

			IF EXISTS(SELECT 1 FROM #error)
			BEGIN
				SELECT * FROM #error
				RETURN 
			END 
  
	
		end
end

	END
	if exists (select 1 from #error)
	begin
		SELECT * FROM #error
		return
	end
	else
	begin
	UPDATE pos.Delivery
		set [Status] = 2,
			LastEditor=@LastEditor,
			LastEditionDate=@LastEditionDate
		WHERE DeliveryID = @DeliveryId
	
		update pi 
		set deliverd = 1
		from pos.PosInvoice pi
		join pos.DeliveryPosInvoice dpi on pi.PosInvoiceID = dpi.PosInvoiceID
		WHERE dpi.DeliveryID = @DeliveryId

		select * from #error
end	
