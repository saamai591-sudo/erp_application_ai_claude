
CREATE   PROCEDURE [NOC].spModificationPreVoucherInsert
	@ModificationID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 
	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Modification'),
				@BaseDegit int,
				@MaxPrevoucherID int,
				@CreatorId int
	
		set @CreatorId = cfg.GetuserID();
		set @BaseDegit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ModificationID) 	

		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by ModificationID) PrevoucherID,
				ModificationID,
				Number,
			    Date,
			    a.Description,
			    a.Description2,
			    a.VoucherItemID,
			    a.SlID,
				FinancialPeriodID,
				vi.CurrencyID,
				CurrencyRate,
				ExchangeUnit,
				IsBaseCurrencyBasis
			into #Modification
	    FROM   NOC.Modification a
		JOIN #DocumentIds b on a.ModificationID = b.ID
		join cfg.FinancialPeriod c on a.Date between startdate and EndDate
		join acc.VoucherItem vi on a.VoucherItemID = vi.VoucherItemID
		join cfg.currency d on d.currencyid = vi.currencyid

	    SELECT	
			a.SlID,
			a.BaseCurrencyDebitAccrue,
			a.BaseCurrencyCreditAccrue,
			a.ModificationID
		  into #ModifiedTopic
	    from noc.ModifiedTopic a
	    join #Modification b on a.ModificationID = b.ModificationID
		--and SlID <> @SlID


	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher](PreVoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PreVoucherID,-1,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Modification
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from noc.Modification a
		join #Modification b on a.ModificationID = b.ModificationID
	
	    -- Insert debit
	    INSERT INTO ACC.PreVoucherItem 
					(
					PreVoucherID ,
					RowIndex	   ,
					SlID           ,
					DESCRIPTION , 
					Description2,
					Debit,			                
					Credit,
					CurrencyID ,
					CurrencyRate, 
					CurrencyDebit, 
					CurrencyCredit,
					Creator,  
					CreationDate,
					LastEditor,
					LastEditionDate,
					Version)
	    SELECT	
			PreVoucherId,
			1,
			SlID,
			Description , 
			Description2 , 
			Debit,
			Credit,
			CurrencyID , 
			CurrencyRate, 
			case when IsBaseCurrencyBasis = 1
					then ROUND(Debit * CurrencyRate / ExchangeUnit , @BaseDegit)
				 when IsBaseCurrencyBasis = 0
					then ROUND(Debit * ExchangeUnit / CurrencyRate , @BaseDegit)
					END,
			case when IsBaseCurrencyBasis = 1
					then ROUND(Credit * CurrencyRate / ExchangeUnit , @BaseDegit)
				 when IsBaseCurrencyBasis = 0
					then ROUND(Credit * ExchangeUnit / CurrencyRate , @BaseDegit)
					END,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
		from #Modification a
		join
		(
		select ModificationID, sum(BaseCurrencyCreditAccrue) Debit, sum(BaseCurrencyDebitAccrue) Credit 
		from #ModifiedTopic
		group by ModificationID
		)b on a.ModificationID = b.ModificationID
		
	    -- Insert credit
	    INSERT INTO ACC.PreVoucherItem 
				(
					PreVoucherID ,
					RowIndex	   ,
					SlID           ,
					DESCRIPTION , 
					Description2,
					Debit,			                
					Credit,
					CurrencyID ,
					CurrencyRate, 
					CurrencyDebit, 
					CurrencyCredit,
					Creator,  
					CreationDate,
					LastEditor,
					LastEditionDate,
					Version)
	    SELECT	
			PreVoucherId,
			1,
			a.SlID,
			Description ,
			Description2 ,
			BaseCurrencyDebitAccrue,
			BaseCurrencyCreditAccrue,
			CurrencyID , 
			CurrencyRate, 
			case when IsBaseCurrencyBasis = 1
					then ROUND(BaseCurrencyDebitAccrue * CurrencyRate / ExchangeUnit , @BaseDegit)
				 when IsBaseCurrencyBasis = 0
					then ROUND(BaseCurrencyDebitAccrue * ExchangeUnit / CurrencyRate , @BaseDegit)
					END,
			case when IsBaseCurrencyBasis = 1
					then ROUND(BaseCurrencyCreditAccrue * CurrencyRate / ExchangeUnit , @BaseDegit)
				 when IsBaseCurrencyBasis = 0
					then ROUND(BaseCurrencyCreditAccrue * ExchangeUnit / CurrencyRate , @BaseDegit)
					END,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0
	    from #ModifiedTopic a
		join #Modification b on a.ModificationID = b.ModificationID

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
			a.prevoucheritemid,
	               s.AccountLevelID,
	               dl.DlID,
	               Value,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		 from #Modification m
		 join acc.prevoucheritem a on a.PreVoucherID = m.PreVoucherID
		 join acc.AccountLevelSL s on s.SlID = a.SlID 
		 join acc.AccountLevelVoucherItem vi on vi.VoucherItemID = m.VoucherItemID and vi.AccountLevelID = s.AccountLevelID
		 join acc.dl on dl.DLID = vi.DlID  and dl.DlTypeID = s.DlTypeID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex
			from #Modification i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID    
