
------------------------------------- START #8406
CREATE     PROCEDURE [STC].spReturnedOutgoingPreVoucherInsert
	@ReturnedOutgoingID NVARCHAR(MAX)

--WITH ENCRYPTION 
	 AS 
	DECLARE @DocumentNumTypeId INT = (		
								SELECT  DNT.DocumentNumTypeID
								FROM   CFG.DocumentNumType DNT
								WHERE  DNT.EngName = 'ReturnedOutgoing'),
			@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'ReturnedOutgoing'),
			@TRACEID INT,
			@CurrentDate datetime,
			@TraceDlTypeID int,
			@MaxPrevoucherID int,
			@creatorId INT ,
			@Culture VARCHAR(10),
			@CultureNo TinyInt,
			@HeaderDescription  nvarchar(max),
			@HeaderDescription2 nvarchar(max),
			@InventoryDescription  nvarchar(max),
			@InventoryDescription2  nvarchar(max),
			@CostDescription nvarchar(max),
			@CostDescription2 nvarchar(max)

		set @CurrentDate = GETDATE();
		set @creatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture()
		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReturnedOutgoingID) 

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'


		select  @InventoryDescription = Description,
				@InventoryDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Inventory'
		
		
	
		

		select  @CostDescription = Description,
				@CostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Cost'

	 	 --- FetchValues ---
		select @MaxPrevoucherID = max(PreVoucherID)
		from acc.PreVoucher

		SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by SRTable.ReturnedOutgoingID) PrevoucherID,
				SRTable.ReturnedOutgoingID,
				SRTable.DlDeliverID,
				St.BranchID,
				SRTable.FinancialPeriodID,
				SRTable.TotalPrice,
				SRTable.date,
				sdt.Title,
				@HeaderDescription [Description],
				@HeaderDescription2 [Description2],
				Number,
				cast(null as varchar(max)) ErrorMessage,
				case when @CultureNo = 1 then sdt.Title else sdt.Title2 end StockDocumentType,
				sdt.SlBaseOnDl,
				sdt.StockDocumentTypeID,
				dl.Code DlCode,
				FullDateAlternateKey,
				PersianFullDateAlternateKey,
				st.StockTypeID,
				st.Title AS StockName,
				st.Title2 AS StockName2,
				sdt.Title AS OutgoingType,
				sdt.Title2 AS OutgoingType2,
				dl.Title AS Recipient,
				dl.Title2 AS Recipient2
			into #ReturnedOutgoing
	    FROM   stc.ReturnedOutgoing  AS SRTable
	    JOIN stf.Stock AS St
	        ON  SRTable.StockID = St.StockID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON SRTable.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		JOIN stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		JOIN #DocumentIds on #DocumentIds.ID = SRTable.ReturnedOutgoingID		
	    JOIN cfg.DimDate DD on DD.Date = SRTable.Date
		left join acc.dl on dl.DLID = SRTable.DlDeliverID


		SET IDENTITY_INSERT [ACC].[PreVoucher] ON
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description,@CreatorId,@CurrentDate,@CreatorId,@CurrentDate,0
		from #ReturnedOutgoing
		SET IDENTITY_INSERT [ACC].[PreVoucher] OFF
    

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from stc.ReturnedOutgoing a
		join #ReturnedOutgoing b on a.ReturnedOutgoingID = b.ReturnedOutgoingID
	   

	    create TABLE #TempOfReturnedOutgoingItems
	    (
			ReturnedOutgoingID int,
			PreVoucherId int,
			ReturnedOutgoingItemID int,
	    	Price				 DECIMAL(18, 4),
	    	Fee					 DECIMAL(18, 4),
	    	InventorySlID        INT,
	    	SlID			 INT,
			StuffAccountGroup nvarchar(1024),
			InventoryDescription			NVARCHAR(MAX),
			InventoryDescription2			NVARCHAR(MAX),
			CostDescription			NVARCHAR(MAX),
			CostDescription2			NVARCHAR(MAX),
			ItemDescription				NVARCHAR(MAX),
			ItemDescription2			NVARCHAR(MAX)
	    )

	    IF EXISTS (SELECT TRACEID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
	    BEGIN
	 
	    DECLARE @Columns NVARCHAR(MAX),
				@ColumnsInALTERTable NVARCHAR(MAX),
				@ColumnsInSelectList NVARCHAR(MAX),
				@Query NVARCHAR(MAX),
				@QueryParam NVARCHAR(MAX);

		select @ColumnsInALTERTable = STUFF((SELECT distinct ' alter TABLE #TempOfReturnedOutgoingItems add' + QUOTENAME(TraceID) +'INT'
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
							   
		if @ColumnsInALTERTable is not null
			exec(@ColumnsInALTERTable);
			
		select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')


		 set @Query = N'INSERT INTO #TempOfReturnedOutgoingItems
	      (
			ReturnedOutgoingID,
			PreVoucherId,
			ReturnedOutgoingItemID,
	        Price,
	        Fee,
	        InventorySlID,
	        SlID,
			StuffAccountGroup,
			InventoryDescription	,
			InventoryDescription2,
			CostDescription,
			CostDescription2,
			ItemDescription,
			ItemDescription2,
			'+@Columns+'
	      )
	    SELECT st.ReturnedOutgoingID,
			   PreVoucherId,
			   ARI.ReturnedOutgoingItemID,
	           ARI.Price,
	           ARI.Fee,
	           sagas.InventorySlID,
	           wip.SlID,
			   stfacc.title,
			   replace(@InventoryDescription,''@@ItemDescription@@'',isnull(ari.Description,'''')),
			   Replace(@InventoryDescription2,''@@ItemDescription@@'',isnull(ari.Description2,'''')),
			   Replace(@CostDescription,''@@ItemDescription@@'',isnull(ari.Description,'''')),
			   Replace(@CostDescription2,''@@ItemDescription@@'',isnull(ari.Description2,'''')),
			   ARI.Description AS ItemDescription,
			   ARI.Description2 AS ItemDescription2,
			   '+@Columns+'
	           
	    FROM   #ReturnedOutgoing St
	           JOIN stc.ReturnedOutgoingItem ARI   ON  St.ReturnedOutgoingID = ARI.ReturnedOutgoingID
	           LEFT JOIN(select ReturnedOutgoingItemID,TraceID,DLID
	           				 from stc.ReturnedOutgoingItemTrace 
	                     WHERE DLID IS NOT NULL ) x
										pivot 
										(
											 max(DLID)
											for TraceID in ( ' + @Columns + ')
										) p  on ARI.ReturnedOutgoingItemID = p.ReturnedOutgoingItemID
	           LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
	           LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			   LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
			   LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
													and wip.StockDocumentTypeID = st.StockDocumentTypeID
													and (wip.dlid is null or wip.DlID = st.DlDeliverID)	           
	           
	    ORDER BY  ARI.RowIndex'
	    SET @QueryParam =N' @InventoryDescription  nvarchar(max),
							@InventoryDescription2  nvarchar(max),
							@CostDescription nvarchar(max),
							@CostDescription2 nvarchar(max)'
	   	EXECUTE sp_executeSQL     
			@Query,
			@QueryParam,
			@InventoryDescription = @InventoryDescription,
			@InventoryDescription2 = @InventoryDescription2,
			@CostDescription = @CostDescription,
			@CostDescription2 = @CostDescription2
	    	   
	    END
	    ELSE
	    BEGIN


	    
	    INSERT INTO #TempOfReturnedOutgoingItems
	      (
			ReturnedOutgoingID,
			PreVoucherId,
			ReturnedOutgoingItemID,
	        Price,
	        Fee,
	        InventorySlID,
	        SlID,
			StuffAccountGroup,
			InventoryDescription,
			InventoryDescription2,
			CostDescription,
			CostDescription2,
			ItemDescription,
			ItemDescription2
	      )
	    SELECT  st.ReturnedOutgoingID,
				PreVoucherId,
				ARI.ReturnedOutgoingItemID,
				ARI.Price,
				ARI.Fee,
				sagas.InventorySlID,
				wip.SlID,
				stfacc.Title,
				REPLACE(@InventoryDescription,'@@ItemDescription@@',ISNULL(ari.[Description],'')),
				REPLACE(@InventoryDescription2,'@@ItemDescription@@',ISNULL(ari.Description2,'')),
				REPLACE(@CostDescription,'@@ItemDescription@@',ISNULL(ari.Description,'')),
				REPLACE(@CostDescription2,'@@ItemDescription@@',ISNULL(ari.Description2,'')),
				ARI.Description AS ItemDescription,
				ARI.Description2 AS ItemDescription2
		FROM   #ReturnedOutgoing St
	    LEFT JOIN stc.ReturnedOutgoingItem ARI   ON  St.ReturnedOutgoingID = ARI.ReturnedOutgoingID	        
	    LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
	    LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
		LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
													and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
	    left join stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
							and wip.StockDocumentTypeID = st.StockDocumentTypeID
							and (wip.dlid is null or wip.DlID = st.DlDeliverID)	           
	    ORDER BY  ARI.RowIndex
	    END
		 
		 update a 
		set ErrorMessage = N'STC_spReturnedOutgoingPreVoucherInsert_2^'+cast(Number as varchar(10))
		from #ReturnedOutgoing a
		join #TempOfReturnedOutgoingItems b on a.ReturnedOutgoingID = b.ReturnedOutgoingID
		where Fee = 0

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') + N'InventorySlNotSpecified^'+cast(Number as varchar(10))
		from #ReturnedOutgoing a
		join #TempOfReturnedOutgoingItems b on a.ReturnedOutgoingID = b.ReturnedOutgoingID
		where InventorySlID IS NULL

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') + case when SlBaseOnDl = 0 then N'SlNotSpecifiedForTheOutgoingTypeInTheStuffGroup^' + StuffAccountGroup + StockDocumentType
								else N'SlNotSpecifiedForTheOutgoingTypeForTheDlInTheStuffGroup^' + StuffAccountGroup + StockDocumentType + dlcode
								end
		from #ReturnedOutgoing a
		join #TempOfReturnedOutgoingItems b on a.ReturnedOutgoingID = b.ReturnedOutgoingID
		where SlID IS NULL 

		if exists (select * from #ReturnedOutgoing where ErrorMessage is not null )
		BEGIN	
			select ReturnedOutgoingID,ErrorMessage from #ReturnedOutgoing
			RETURN;
		END
	  		 
	     -- Insert Inventory
	        INSERT INTO ACC.PreVoucherItem
	          ( PreVoucherID,
	            RowIndex,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            IsAutoGenerated,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	        SELECT PreVoucherId,
				   1,
	               it.InventorySlID,
	               InventoryDescription,
	               InventoryDescription2,
	               it.Price,
	               0,	               
	               -1,
	               1,
	               it.Price,
	               0,	      
	               1,         	               
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
				   'ReturnedOutgoingItem',
				   ReturnedOutgoingItemID
	        FROM   #TempOfReturnedOutgoingItems It
			
	      INSERT INTO ACC.PreVoucherItem
	          ( PreVoucherID,
	            RowIndex,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            IsAutoGenerated,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	         SELECT PreVoucherId,
	               1,
	               it.SlId,
	               CostDescription,
	               CostDescription2,
	               0,
	               it.Price,
	               -1,
	               1,
	               0,
	               it.Price,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
				   'ReturnedOutgoingItem',
				   ReturnedOutgoingItemID
	        FROM   #TempOfReturnedOutgoingItems It
	  	        
	      INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT a.PreVoucherItemID,
	               b.AccountLevelID,
	               DlDeliverID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #ReturnedOutgoing h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.DlDeliverID and c.DlTypeID = b.DlTypeID


	      INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
			SELECT 
				a.PreVoucherItemID,
				b.AccountLevelID,
				c.DlID,
				NULL,
				@creatorId,
				@CurrentDate,
				@creatorId,
				@CurrentDate,
				0
				from #ReturnedOutgoing h
				join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
				join acc.accountlevelsl b on a.slid = b.slid 
				join stc.ReturnedOutgoingDl c on c.ReturnedOutgoingID = h.ReturnedOutgoingID and c.DlTypeID = b.DlTypeID


	      DECLARE db_cursor CURSOR FOR
			select TRACEID,DlTypeID
			FROM STF.Trace WHERE DlTypeID IS NOT NULL
	 	
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @TRACEID,@TraceDlTypeID

		WHILE @@FETCH_STATUS = 0   
		BEGIN  
		 set @Query = N'INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT pvi.prevoucheritemID,
	               als.AccountLevelID,
	               a.'+QUOTENAME(@TRACEID)+',
	               NULL,
	               @pCreatorId,
	               GETDATE(),
	               @pCreatorId,
	               GETDATE(),
	               0
	        FROM    #TempOfReturnedOutgoingItems a
			join acc.prevoucheritem pvi on pvi.BaseDocumentName = ''ReturnedOutgoingItem'' and pvi.BaseDocumentID = a.ReturnedOutgoingItemID
	        INNER JOIN Acc.AccountLevelSL als ON  als.SlID =  pvi.SlID
	        WHERE  als.DlTypeID = @pDlTypeId and a.'+QUOTENAME(@TRACEID)+' is not null'
	        
	   SET @QueryParam =N'@pCreatorId INT,@pDlTypeId INT'
		
		EXECUTE sp_executeSQL     
			@Query,
			@QueryParam,
			@pCreatorId = @creatorId,
			@pDlTypeId = @TraceDlTypeID  
			
		FETCH NEXT FROM db_cursor INTO @TRACEID,@TraceDlTypeID 
		END   

		CLOSE db_cursor   
		DEALLOCATE db_cursor  

			;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@StockName@@',StockName),
						'@@OutgoingType@@',OutgoingType),
						'@@Recipient@@',Recipient) 						[Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@StockName@@',StockName2),
						'@@OutgoingType@@',OutgoingType2),
						'@@Recipient@@',Recipient2),
						'@@ItemDescription@@',ISNULL(troi.ItemDescription2,''))
						[Description2]
			from #ReturnedOutgoing i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
			JOIN #TempOfReturnedOutgoingItems troi ON i.ReturnedOutgoingID = troi.ReturnedOutgoingID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID

		update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@StockName@@',StockName),
						'@@OutgoingType@@',OutgoingType),
						'@@Recipient@@',Recipient),
						'@@ItemDescription@@',ISNULL(troi.ItemDescription,'')),
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@StockName@@',StockName2),
						'@@OutgoingType@@',OutgoingType2),
						'@@Recipient@@',Recipient2),
						'@@ItemDescription@@',ISNULL(troi.ItemDescription2,''))
		from acc.PreVoucher pi
		join #ReturnedOutgoing i on pi.PrevoucherID = i.PrevoucherID
		JOIN #TempOfReturnedOutgoingItems troi ON pi.PrevoucherID = troi.PrevoucherID
