CREATE      PROCEDURE [ACC].[RptTafsilReview]
(
    @FinicialPeriodID        INT,
    @DocumentTypeIds         VARCHAR(500)=null,
    @FromNumber              INT = NULL,
    @ToNumber                INT = NULL,
    @FromSubNumber           INT = NULL,
    @ToSubNumber             INT = NULL,
    @FromDate                DATE = NULL,
    @ToDate                  DATE = NULL,
    @SelectedSlTreeLevel     VARCHAR(MAX) = NULL ,
    @AccountLevelID          INT,
    @SelectedBranch          VARCHAR(MAX) = NULL,
    @FromReferenceNumber     INT = NULL,
    @ToReferenceNumber       INT = NULL,
    @SelectedDL              VARCHAR(MAX) = NULL,
    @IsCurrency              BIT = 0,
    @SelecedDlType           VARCHAR(MAX) = NULL,
    @HasRemainValue          BIT = 0,
	@ShowType tinyint ,
	@voucherStatusIds VARCHAR(500) = NULL
)

--WITH ENCRYPTION
WITH RECOMPILE
AS

SET NOCOUNT ON;
	DECLARE @ConstCurrency     BIGINT = 100000000,
	        @Culture           VARCHAR(25),
	        @CultureNo         TINYINT,
			@StrAccountLevelID VARCHAR(25),
			@Query nvarchar(max)

	set @StrAccountLevelID = @AccountLevelID
	SET @Culture = CFG.GetuserCulture() ;
	SELECT @CultureNo = ISNULL(CultureNo, 1)
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	Declare @ResTable varchar(max)
	set @ResTable = cfg.getTempTableName(1);

	exec [ACC].SpReportDataSource
				@FinicialPeriodID   ,
				@DocumentTypeIds    ,
				@FromNumber         ,
				@ToNumber           ,
				@FromSubNumber      ,
				@ToSubNumber        ,
				@FromDate           ,
				@ToDate             ,
				@SelectedBranch     ,
				@FromReferenceNumber,
				@ToReferenceNumber  ,
				@ShowType           ,
				@voucherStatusIds   ,
				@SelectedSlTreeLevel,
				@SelecedDlType      ,
				@SelectedDL         ,
				@ResTable,
				@IsCurrency
	
	IF @AccountLevelID = -1
	BEGIN

		CREATE TABLE #DlType
		(
			id           INT
		)

		INSERT INTO #DlType
		SELECT cfg.GetStringPart(VALUE, 1)
		FROM   cfg.Split(@SelecedDlType, '#')	

		select * into  #SelectedDltype
		from #DlType
		group by ID



	    IF @IsCurrency = 0
	    BEGIN
		create table #Temp1
		(
		dlid int,
		Debit Decimal(36,10),
		Credit Decimal(36,10)
		)
		set @Query= N'insert into #Temp1
			   select d.dlid,
					  ISNULL(SUM(Debit), 0)      Debit,
					  ISNULL(SUM(Credit), 0)     Credit			
				from '+@ResTable+' vi
				INNER  JOIN acc.AccountLevelVoucherItem alvi
	                ON  alvi.VoucherItemID = vi.VoucherItemID
				INNER JOIN acc.DL AS d
					ON  d.DLID = alvi.DlID
				LEFT JOIN #SelectedDltype dlt
					ON dlt.id = d.DlTypeID
				WHERE  alvi.DlID IS NOT NULL
				and (@SelecedDlType is null or dlt.id is not null)
				group by d.dlid'
			EXECUTE sp_executeSQL     
					@Query,
					N'@SelecedDlType NVARCHAR(MAX)',
					@SelecedDlType = @SelecedDlType
					
	        SELECT d.dlid       KeyField,
				   case when @CultureNo = 1 then d.Title
	                    when @CultureNo = 2 then d.Title2
	               end as Title,
				   case when @CultureNo = 1 then dt.Title
	                    when @CultureNo = 2 then dt.Title2
	               end as DlTypeTitle,
	               d.dlid       SlID,
	               d.code    AS FullCode,
	               Debit,
	               Credit,
	               CASE 
	                    WHEN Debit > Credit THEN Debit - Credit
	                    ELSE 0
	               END       AS DebitRemain,
	               CASE 
	                    WHEN Debit < Credit THEN Credit - Debit
	                    ELSE 0
	               END       AS CreditRemain
	        FROM   #Temp1 vi
	               INNER JOIN Acc.DL d
	                    ON  vi.DLID = d.DLID
	               INNER JOIN Acc.DlType dt
	                    ON  d.DlTypeID = dt.DlTypeID
	        WHERE  (@HasRemainValue = 0 OR Debit <> Credit)
	    END
	    ELSE
	    BEGIN
			create table #CurrencyTemp1
			(
			dlid int,
			CurrencyID int,
			Debit Decimal(36,10),
			Credit Decimal(36,10),
			CurrencyDebit Decimal(36,10),
			CurrencyCredit Decimal(36,10)
			)
			set @Query = N'insert into #CurrencyTemp1
				   select d.dlid,
						  CurrencyID,
						  ISNULL(SUM(Debit), 0)   AS Debit,
						  ISNULL(SUM(Credit), 0)  AS Credit,
						  ISNULL(SUM(CurrencyDebit), 0) AS CurrencyDebit,
						  ISNULL(SUM(CurrencyCredit), 0) AS CurrencyCredit		
					from '+@ResTable+' vi
					INNER  JOIN acc.AccountLevelVoucherItem alvi
						ON  alvi.VoucherItemID = vi.VoucherItemID
					INNER JOIN acc.DL AS d
						ON  d.DLID = alvi.DlID
					LEFT JOIN #SelectedDltype dlt
						ON dlt.id = d.DlTypeID
					WHERE  alvi.DlID IS NOT NULL
					and (@SelecedDlType is null or dlt.id is not null)
					group by d.dlid,
							 CurrencyID'
			EXECUTE sp_executeSQL     
					@Query,
					N'@SelecedDlType NVARCHAR(MAX)',
					@SelecedDlType = @SelecedDlType
	       
	        SELECT d.dlid + vi.currencyId * @ConstCurrency KeyField,
			       case when @CultureNo = 1 then d.Title
	                    when @CultureNo = 2 then d.Title2
	               end as Title,
				   case when @CultureNo = 1 then dt.Title
	                    when @CultureNo = 2 then dt.Title2
	               end as DlTypeTitle,	              
	               d.dlid       SlID,
	               d.code    AS FullCode,
	               vi.CurrencyID,
				   case when @CultureNo = 1 then c.Title
	                    when @CultureNo = 2 then c.Title2
	               end as CurrencyTitle,
	               Debit,
	               Credit,
	               CurrencyCredit,
	               CurrencyDebit,
	               CASE 
	                    WHEN Debit > Credit THEN Debit - Credit
	                    ELSE 0
	               END       AS DebitRemain,
	               CASE 
	                    WHEN Debit < Credit THEN Credit - Debit
	                    ELSE 0
	               END       AS CreditRemain,
	               CASE 
	                    WHEN CurrencyDebit > CurrencyCredit THEN CurrencyDebit - 
	                         CurrencyCredit
	                    ELSE 0
	               END       AS CurrencyDebitRemain,
	               CASE 
	                    WHEN CurrencyDebit < CurrencyCredit THEN CurrencyCredit 
	                         - 
	                         CurrencyDebit
	                    ELSE 0
	               END       AS CurrencyCreditRemain
	        FROM   #CurrencyTemp1 vi
	               INNER JOIN Acc.DL d
	                    ON  vi.DLID = d.DLID
	               INNER JOIN Acc.DlType dt
	                    ON  d.DlTypeID = dt.DlTypeID
	               INNER JOIN cfg.Currency AS c
	                    ON  c.CurrencyID = vi.CurrencyID
	        WHERE  (
	                   @HasRemainValue = 0
	                   OR Debit <> Credit
	                   OR CurrencyDebit <> CurrencyCredit
	               )
	    END
	END
	
	IF @AccountLevelID <> -1
	BEGIN
	    IF @IsCurrency = 0
	    BEGIN
		create table #Temp2
		(
		dlid int,
		Debit Decimal(36,10),
		Credit Decimal(36,10)
		)
		exec(N'insert into #Temp2
			   select dlid,
					  ISNULL(SUM(Debit), 0)      Debit,
					  ISNULL(SUM(Credit), 0)     Credit			
				from '+@ResTable+' vi
				INNER  JOIN acc.AccountLevelVoucherItem alvi
	                ON  alvi.VoucherItemID = vi.VoucherItemID
				WHERE  alvi.AccountLevelID = '+@StrAccountLevelID+'
				and alvi.DlID IS NOT NULL
				group by dlid')

	        SELECT d.dlid       KeyField,
			       case when @CultureNo = 1 then d.Title
	                    when @CultureNo = 2 then d.Title2
	               end as Title,
				   case when @CultureNo = 1 then dt.Title
	                    when @CultureNo = 2 then dt.Title2
	               end as DlTypeTitle,	               
	               d.dlid       SlID,
	               d.code    AS FullCode,
	               Debit,
	               Credit,
	               CASE 
	                    WHEN Debit > Credit THEN Debit - Credit
	                    ELSE 0
	               END       AS DebitRemain,
	               CASE 
	                    WHEN Debit < Credit THEN Credit - Debit
	                    ELSE 0
	               END       AS CreditRemain
	        FROM   #Temp2 vi
	               INNER JOIN Acc.DL d
	                    ON  vi.DLID = d.DLID
	               INNER JOIN Acc.DlType dt
	                    ON  d.DlTypeID = dt.DlTypeID
	        WHERE  (@HasRemainValue = 0 OR Debit <> Credit)
	        
	    END
	    ELSE
	    BEGIN
			create table #CurrencyTemp2
			(
			dlid int,
			CurrencyID int,
			Debit Decimal(36,10),
			Credit Decimal(36,10),
			CurrencyDebit Decimal(36,10),
			CurrencyCredit Decimal(36,10)
			)
			exec(N'insert into #CurrencyTemp2
				   select dlid,
						  CurrencyID,
						  ISNULL(SUM(Debit), 0)   AS Debit,
						  ISNULL(SUM(Credit), 0)  AS Credit,
						  ISNULL(SUM(CurrencyDebit), 0) AS CurrencyDebit,
						  ISNULL(SUM(CurrencyCredit), 0) AS CurrencyCredit		
					from '+@ResTable+' vi
						INNER  JOIN acc.AccountLevelVoucherItem alvi
							ON  alvi.VoucherItemID = vi.VoucherItemID
				WHERE  alvi.AccountLevelID = '+@StrAccountLevelID+'
				and alvi.DlID IS NOT NULL
					group by dlid,
							 CurrencyID')

	        SELECT d.dlid + vi.currencyId * @ConstCurrency KeyField,
	               case when @CultureNo = 1 then d.Title
	                    when @CultureNo = 2 then d.Title2
	               end as Title,				   
				   case when @CultureNo = 1 then dt.Title
	                    when @CultureNo = 2 then dt.Title2
	               end as DlTypeTitle,				   
	               d.dlid       SlID,
	               d.code    AS FullCode,
	               vi.CurrencyID,
				   case when @CultureNo = 1 then c.Title
	                    when @CultureNo = 2 then c.Title2
	               end as CurrencyTitle,
	               Debit,
	               Credit,
	               CurrencyCredit,
	               CurrencyDebit,
	               CASE 
	                    WHEN Debit > Credit THEN Debit - Credit
	                    ELSE 0
	               END       AS DebitRemain,
	               CASE 
	                    WHEN Debit < Credit THEN Credit - Debit
	                    ELSE 0
	               END       AS CreditRemain,
	               CASE 
	                    WHEN CurrencyDebit > CurrencyCredit THEN CurrencyDebit - 
	                         CurrencyCredit
	                    ELSE 0
	               END       AS CurrencyDebitRemain,
	               CASE 
	                    WHEN CurrencyDebit < CurrencyCredit THEN CurrencyCredit 
	                         - 
	                         CurrencyDebit
	                    ELSE 0
	               END       AS CurrencyCreditRemain
	        FROM   #CurrencyTemp2 vi
	               INNER JOIN Acc.DL d
	                    ON  vi.DLID = d.DLID
	               INNER JOIN Acc.DlType dt
	                    ON  d.DlTypeID = dt.DlTypeID
	               INNER JOIN cfg.Currency AS c
	                    ON  c.CurrencyID = vi.CurrencyID
	        WHERE  (
	                   @HasRemainValue = 0
	                   OR Debit <> Credit
	                   OR CurrencyDebit <> CurrencyCredit
	               )
	    END
	END
