
CREATE   PROCEDURE [FIN].SpRptFinance_PaymentCommitment
--WITH ENCRYPTION     
AS
BEGIN

	DECLARE @Payment NVARCHAR(100),
			@DrawBack NVARCHAR(100),
			@Revoke NVARCHAR(100),
			@Cheque NVARCHAR(100),
			@Promissory NVARCHAR(100),
			@Guaranty NVARCHAR(100),
			@InProgress NVARCHAR(100),
			@CashFromBank NVARCHAR(100),
			@UserID int,
			@Culture varchar(50),
			@DateType          TINYINT,
		    @DateFormat        VARCHAR(10),
			@CultureNo tinyint
			
	set @UserID = cfg.GetuserID()
	set @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 	
	SELECT @Payment = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'PaymentCheqeCommitmentState' 
	AND le.Item = 'Payment'
	AND lev.Culture = @Culture


	SELECT @DrawBack = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'PaymentCheqeCommitmentState' 
	AND le.Item = 'DrawBacked'
	AND lev.Culture = @Culture
	
	
	SELECT @Revoke = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'PaymentCheqeCommitmentState' 
	AND le.Item = 'Revoke'
	AND lev.Culture = @Culture	
	
	
	SELECT @Cheque = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'CommitmentDocumentsType' 
	AND le.Item = 'Cheque'
	AND lev.Culture = @Culture
	
	
	SELECT @Promissory = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'CommitmentDocumentsType' 
	AND le.Item = 'Promissory'
	AND lev.Culture = @Culture
	
	
	SELECT @Guaranty = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'CommitmentDocumentsType' 
	AND le.Item = 'Guaranty'
	AND lev.Culture = @Culture
	
	
	SELECT @InProgress = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'GuarantyState' 
	AND le.Item = 'InProgress'
	AND lev.Culture = @Culture
	
	
	SELECT @CashFromBank = lev.[Value]
	FROM cfg.LocalizeEnum le
	JOIN cfg.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = 'GuarantyState' 
	AND le.Item = 'CashFromBank'
	AND lev.Culture = @Culture
	

		SELECT * INTO #vwBranchAccess
FROM cfg.vwBranchAccess AS vba	
	

		select p.PartyID,
		       d.Code PartyCode,
		       CASE WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title
	                    WHEN p.[Type] = 0 THEN p.Title + ' ' + p.LastName
	               END PartyTitle,
			   CASE WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title2
	                    WHEN p.[Type] = 0 THEN p.Title2 + ' ' + p.LastName2
	               END PartyTitle2
		into #Parties
		from CFG.Party p
		left join ACC.DL d on p.DlID = d.DLID

	SELECT DISTINCT ROW_NUMBER() OVER(ORDER BY p.Number) RowID,
			DocumentID,
			DocumentType,
			DocumentNumber,
			a.[Date] MaturityDate,
			CFG.GetCLRSaturnDate(a.[Date],@DateFormat,0,@DateType) Date_MaturityDate,
			a.CurrencyID,
			case when @CultureNo = 1 then cu.Title
	             when @CultureNo = 2 then cu.Title2
	        end as CurrencyTitle,
			a.CurrencyRate CurrencyRate,
			a.Amount,
			LastState,
			p.PaymentCommitmentID,
			p.Number,
			p.[Date] PaymentDate,
			CFG.GetCLRSaturnDate(p.[Date],@DateFormat,0,@DateType) Date_PaymentDate,
			p.BranchID,
			b.Code BranchCode,
			case when @CultureNo = 1 then b.Title
	             when @CultureNo = 2 then b.Title2
	        end as BranchName,
			p.PartyID,
			pa.PartyCode,
			case when @CultureNo = 1 then pa.PartyTitle
	             when @CultureNo = 2 then pa.PartyTitle2
	        end as PartyName,
			p.ContractID,
			cd.Code ContractDlCode,
			p.TenderID,
			case when @CultureNo = 1 then t.Title
	             when @CultureNo = 2 then t.Title2
	        end as TenderTitle,
		case when @CultureNo = 1 then p.Description
	           when @CultureNo = 2 then p.Description2
	      end as Description,
		case when @CultureNo = 1 then ct.Title
	           when @CultureNo = 2 then ct.Title2
	      end as CommitmentType,
		  		  CASE 
		  WHEN @CultureNo = 2 THEN bk.Title2 ELSE bk.Title END AS BankTitle
	 FROM 
	(
		select DISTINCT pc.PaymentCheqeCommitmentID DocumentID,
				@Cheque DocumentType,
				pc.Number DocumentNumber,
				pc.[Date] ,
				pc.CurrencyID,
				pc.CurrencyRate CurrencyRate,
				pc.Amount,
				case pc.LastState
					when 0 then @Payment
					when 1 then @DrawBack
					when 3 then @Revoke
				end LastState,
				PaymentCommitmentID,
				CommitmentTypeID,
				NULL AS BankAccountID
		from FIN.PaymentCheqeCommitment pc

		union all
		
		select  p.PaymentPromissoryCommitmentID DocumentID,
				@Promissory DocumentType,
				p.Number DocumentNumber,
				p.[Date] ,
				p.CurrencyID,
				p.CurrencyRate CurrencyRate,
				p.Amount,
				case p.LastState
					when 0 then @Payment
					when 1 then @DrawBack
				end LastState,
				PaymentCommitmentID,
				CommitmentTypeID,
				NULL AS BankAccountID
				from FIN.PaymentPromissoryCommitment p 
		union  all
		select pg.PaymentGuarantyCommitmentID DocumentID, 
		@Guaranty DocumentType,
		pg.Number DocumentNumber,
		case when oa.DueDate is not null then oa.DueDate else pg.[Date] end [Date],
		pg.CurrencyID,
		pg.CurrencyRate CurrencyRate,
        CASE de.OperationType
             WHEN 5 THEN pg.Amount  + isnull(de.DeductedAmount,0)
             WHEN 2 THEN pg.Amount  - isnull(de.DeductedAmount,0)
			 ELSE pg.Amount
        END AS Amount,
		case pg.LastState
			when 1 then @InProgress
			when 2 then @Revoke
			when 3 then @CashFromBank
		end LastState,
		PaymentCommitmentID,
		CommitmentTypeID,
	     pg.BankAccountID AS BankAccountID
		from FIN.PaymentGuarantyCommitment pg
		left join
		(
		select PaymentGuarantyCommitmentID,
			sum(DeductedAmount) DeductedAmount,
			OperationType
		from fin.GuarantyOperation
		where OperationType = 2 OR OperationType=5
		group by PaymentGuarantyCommitmentID,OperationType
		)de on de.PaymentGuarantyCommitmentID = pg.PaymentGuarantyCommitmentID
		outer apply
		(
		select top 1 a.DueDate
		from fin.GuarantyOperation a
		where a.OperationType = 1
		and a.PaymentGuarantyCommitmentID = pg.PaymentGuarantyCommitmentID
		order by a.DueDate desc
		)oa

	) as a
		join FIN.PaymentCommitment p on a.PaymentCommitmentID = p.PaymentCommitmentID
		join fin.CommitmentType ct on ct.CommitmentTypeID = a.CommitmentTypeID
		join CFG.Currency cu on a.CurrencyID = cu.CurrencyID
		join CFG.Branch b on p.BranchID = b.BranchID
		join #Parties pa on p.PartyID = pa.PartyID
		left join VND.Tender t on p.TenderID = t.TenderID
		left join CNT.[Contract] co on p.ContractID = co.ContractID
		left join acc.DL cd on co.DLID = cd.DLID
		INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = b.BranchID 
	    LEFT JOIN cfg.BankAccount ba on a.BankAccountID = ba.BankAccountID
		LEFT JOIN CFG.BankBranch bb on ba.BankBranchID = bb.BankBranchID
		LEFT JOIN CFG.Bank bk on bb.BankID = bk.BankID
		

END
