
CREATE      PROCEDURE [ACC].spExportationOpeningOrClosingVoucher
(
    @FinicialPeriodID         INT,
    @DocumentTypeEngName      NVARCHAR(256),
    @Date                     DATE,
    @Creator                  INT,
    @NonDlAccountLevelIDs     VARCHAR(MAX),
    @BranchId                 INT
)

--WITH ENCRYPTION
AS
	DECLARE @FStartDate         DATE,
	        @DocumentTypeID     INT,
	        @Count              INT,
	        @Message            NVARCHAR(MAX),
	        @VoucherID          INT,
	        @Closing            NVARCHAR(100),
	        @ClosingStr         NVARCHAR(100),
	        @Opening            NVARCHAR(100),
	        @OpeningStr         NVARCHAR(100),
			@CompanyID          int;

	select @CompanyID=CompanyID
	from CFG.Branch
	where BranchID=@BranchId

	SELECT @FStartDate = fp.StartDate
	FROM   CFG.FinancialPeriod fp
	WHERE  fp.FinancialPeriodID = @FinicialPeriodID;
	
	SELECT @DocumentTypeID = DocumentTypeID
	FROM   ACC.DocumentType dt
	WHERE  dt.engname = @DocumentTypeEngName;
	--------------------------------
	
	SELECT @Closing = lev.[Value]
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentTypes'
	       AND le.Item = 'Closing'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @ClosingStr = '''' + lev.[Value] + ''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentTypes'
	       AND le.Item = 'Closing'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @Opening = lev.[Value]
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentTypes'
	       AND le.Item = 'Opening'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @OpeningStr = '''' + lev.[Value] + ''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentTypes'
	       AND le.Item = 'Opening'
	       AND lev.Culture = CFG.GetuserCulture();
	
	------------------------------------ valdate vouchers --------------------------------------
	BEGIN TRY

		EXEC ACC.ValidateVouchers @voucherIDs = @VoucherID,	-- nvarchar(max)
			 @currentFinancialPeriodID = @FinicialPeriodID,	-- int
			 @isDelete = 0,	-- bit
			 @voucherItemIds = DEFAULT -- nvarchar(max)
	          
	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT @ErrorMessage = ERROR_MESSAGE(),
			   @ErrorSeverity = ERROR_SEVERITY(),
			   @ErrorState = ERROR_STATE();

		RAISERROR(   @ErrorMessage,  -- Message text.
					 @ErrorSeverity, -- Severity.
					 @ErrorState     -- State.
				 );
		RETURN;
	END CATCH;
	--------------------------------------------------------------------------------------------
	-------------------------------------------
	IF (@DocumentTypeEngName = 'Opening')
	BEGIN
	    IF EXISTS (
	           SELECT *
	           FROM   ACC.Voucher v
	           WHERE  v.FinancialPeriodID = @FinicialPeriodID
	                  AND v.BranchID = @BranchId
	                  AND v.DocumentTypeID IN (SELECT DocumentTypeID
	                                           FROM   ACC.DocumentType
	                                           WHERE  engname = 'Closing')
	       )
	    BEGIN
	        RAISERROR( 'ACC_spExportationOpeningOrClosingVoucher_1', 16, 12);
	        RETURN;
	    END;
	END;
	
	IF NOT EXISTS (
	       SELECT 1
	       FROM   ACC.Voucher v
	       WHERE  v.FinancialPeriodID = @FinicialPeriodID
	              AND v.BranchID = @BranchId
	              AND v.DocumentTypeID = @DocumentTypeID
	   )
	BEGIN
	    DECLARE @LatestConfirmedVoucherDate DATETIME = NULL;
	    SELECT TOP 1 @LatestConfirmedVoucherDate = v.[Date]
	    FROM   ACC.Voucher v
	    WHERE  v.BranchID = @BranchId
	           AND v.VoucherStatusID = 4
	           AND v.FinancialPeriodID = @FinicialPeriodID
	    ORDER BY
	           v.[Date] DESC; --گرفتن تاريخ آخرين سند تاييد شده دوره مالي جاري
	    
	    IF (@Date < @LatestConfirmedVoucherDate)
	    BEGIN
	        RAISERROR('ACC_spExportationOpeningOrClosingVoucher_2', 16, 12);
	        RETURN;
	    END;
	    
	    IF OBJECT_ID('tempdb..##Exportation') IS NOT NULL
	        DROP TABLE ##Exportation;
	    
	    IF OBJECT_ID('tempdb..##UnPivot') IS NOT NULL
	        DROP TABLE ##UnPivot;
	    
	    IF (@DocumentTypeEngName = 'Closing')
	    BEGIN
	        IF EXISTS (
	               SELECT 1
	               FROM   ACC.Voucher v
	               WHERE  v.BranchID = @BranchId
	                      AND v.FinancialPeriodID = @FinicialPeriodID
	                      AND v.VoucherStatusID != 4
	           )
	        BEGIN
	            RAISERROR('ACC_spExportationOpeningOrClosingVoucher_3', 16, 12);
	            RETURN;
	        END;
	    ELSE
	    BEGIN
	        IF EXISTS (
	               SELECT vi.SlID
	               FROM   (
	                          SELECT v.VoucherID,
	                                 v.BranchID,
	                                 v.FinancialPeriodID,
	                                 v.DocumentTypeID,
	                                 v.Number,
	                                 v.ReferenceNumber,
	                                 v.DailyNumber,
	                                 v.SubNumber,
	                                 v.Date,
	                                 v.VoucherStatusID,
	                                 v.Description,
	                                 v.Description2,
	                                 v.Total,
	                                 v.Creator,
	                                 v.CreationDate,
	                                 v.Version,
	                                 v.LastEditor,
	                                 v.LastEditionDate
	                          FROM   ACC.Voucher v
	                          WHERE  v.BranchID = @BranchId
	                                 AND v.FinancialPeriodID = @FinicialPeriodID
	                      ) v
	                      INNER JOIN ACC.VoucherItem vi
	                           ON  vi.VoucherID = v.VoucherID
	                      INNER JOIN ACC.SL s --معين
	                           ON  s.SlID = vi.SlID
	                      INNER JOIN ACC.SL s2 -- کل
	                           ON  s2.SlID = s.ParentID
	                      INNER JOIN ACC.SL s3 --گروه
	                           ON  s3.SlID = s2.ParentID
	               WHERE  s3.BalanceTypeID = 4
	               GROUP BY
	                      --SATURNNEW-1624
	                      vi.SlID,
	                      vi.CurrencyID
	               HAVING (SUM(vi.Credit) - SUM(vi.Debit) != 0)
	           )
	        BEGIN
	            RAISERROR('ACC_spExportationOpeningOrClosingVoucher_4', 16, 12);
	            RETURN;
	        END;


select * into #vwAccount
from acc.vwaccounts

	        
	        SELECT vi.SlID
			INTO #notClosedSls
	        FROM   (
	                    SELECT v.VoucherID,
	                            v.BranchID,
	                            v.FinancialPeriodID,
	                            v.DocumentTypeID,
	                            v.Number,
	                            v.ReferenceNumber,
	                            v.DailyNumber,
	                            v.SubNumber,
	                            v.Date,
	                            v.VoucherStatusID,
	                            v.Description,
	                            v.Description2,
	                            v.Total,
	                            v.Creator,
	                            v.CreationDate,
	                            v.Version,
	                            v.LastEditor,
	                            v.LastEditionDate
	                    FROM   ACC.Voucher v
	                    WHERE  v.BranchID = @BranchId
	                            AND v.FinancialPeriodID = @FinicialPeriodID
	                ) v
	                INNER JOIN ACC.VoucherItem vi
	                    ON  vi.VoucherID = v.VoucherID
	                INNER JOIN #vwAccount s --معين
	                    ON  s.SlID = vi.SlID
	        WHERE  vi.CurrencyID <> -1   --AND s.HasCurrencyConversion = 1
	        GROUP BY
	                --SATURNNEW-1624
	                vi.SlID,
	                vi.CurrencyID
	        HAVING (
	                    (
	                        SUM(vi.Credit)
	                        - SUM(vi.Debit) = 0
	                        AND SUM(vi.CurrencyDebit)
	                            - SUM(vi.CurrencyCredit) <> 0
	                    )
	                )
	        OR (
	                (
	                    SUM(vi.Credit)
	                    - SUM(vi.Debit) <> 0
	                    AND SUM(vi.CurrencyDebit)
	                        - SUM(vi.CurrencyCredit) = 0
	                )
	            )
	        
	        --/SATURNNEW-3759
	        IF EXISTS (
	               SELECT 1 FROM #notClosedSls
	           )
	        BEGIN
				declare @slFullCodes nvarchar(500)
				SELECT @slFullCodes = STUFF(
					   (
						   SELECT ',' + ACC.SlFullCode(SlID) FROM #notClosedSls FOR XML PATH('')
					   ),
					   1,
					   1,
					   '')
			
				declare @msg  nvarchar(max)=  N'مانده ارزي و ريالي بعضي از حسابها همخواني ندارند  ' + @slFullCodes

	            RAISERROR(@msg, 16, 12);
	            --ابتدا حسابهاي سود و زياني داراي مانده بسته شود.
	            RETURN;
	        END;
	        
	        --Insert Voucher
	        SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
	        
	        INSERT INTO [ACC].[Voucher]
	          (
	            [BranchID],
	            [FinancialPeriodID],
	            [DocumentTypeID],
	            [Number],
	            [ReferenceNumber],
	            [DailyNumber],
	            [SubNumber],
	            [Date],
	            [VoucherStatusID],
	            [Description],
	            [Description2],
	            [Total],
	            [Creator],
	            [CreationDate],
	            [Version],
	            [LastEditor],
	            [LastEditionDate],
				[AutoGenerated]
	          )
	        VALUES
	          (
	            @BranchId,
	            @FinicialPeriodID,
	            @DocumentTypeID,
	                (
	                    SELECT ISNULL(MAX(Number), 0) + 1
	                    FROM   [ACC].[Voucher] as v
						INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	                    WHERE  FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	                ),
	            
	                (
	                    SELECT ISNULL(MAX(v.ReferenceNumber),0) + 1
	                    FROM   [ACC].[Voucher] v
						INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	                    WHERE  FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	                ),
	            
	                (
	                    SELECT ISNULL(MAX(DailyNumber), 0) + 1
	                    FROM   [ACC].[Voucher] v
						INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	                    WHERE  [Date] = @Date
	                           AND FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	                ),
	            NULL,
	            @Date,
	            4,
	            @Closing,
	            @Closing,
	            0,
	            @Creator,
	            GETDATE(),
	            0,
	            @Creator,
	            GETDATE(),
				1
	          );
	        
	        --گرفتن اقلام سند اختتاميه و صدور سند اختتاميه
	        ------------------------------------------------------------
	        SET @VoucherID = SCOPE_IDENTITY();
	        
	        SELECT vi.SlID,
	               vi.Debit,
	               vi.Credit,
	               vi.CurrencyDebit,
	               vi.CurrencyCredit,
	               s.SlTitle,
	               vi.VoucherItemID,
	               vi.CurrencyID,
	               @BranchId AS BranchID
	        INTO   #T
	        FROM   (
	                   SELECT v.VoucherID,
	                          v.BranchID,
	                          v.FinancialPeriodID,
	                          v.DocumentTypeID,
	                          v.Number,
	                          v.ReferenceNumber,
	                          v.DailyNumber,
	                          v.SubNumber,
	                          v.Date,
	                          v.VoucherStatusID,
	                          v.Description,
	                          v.Description2,
	                          v.Total,
	                          v.Creator,
	                          v.CreationDate,
	                          v.Version,
	                          v.LastEditor,
	                          v.LastEditionDate
	                   FROM   ACC.Voucher v
	                   WHERE  v.BranchID = @BranchId
	                          AND v.FinancialPeriodID = @FinicialPeriodID
	                          AND v.DocumentTypeID <> 7
	               ) v
	               INNER JOIN ACC.VoucherItem vi
	                    ON  vi.VoucherID = v.VoucherID
	               INNER JOIN #vwAccount s
	                    ON  s.SlID = vi.SlID
					where s.plbalancetypeCode <> 4;
	        
	        DECLARE @SelectQuery2       NVARCHAR(MAX),
	                @JoinQuery2         NVARCHAR(MAX),
	                @SelectQuery        NVARCHAR(MAX),
	                @JoinQuery          NVARCHAR(MAX),
	                @Query              NVARCHAR(MAX),
	                @GroupByQuery       NVARCHAR(MAX),
	                @IStr               VARCHAR(2),
	                @SelectQuery3       NVARCHAR(MAX),
	                @Columns            VARCHAR(MAX),
	                @ColumnsUnpivot     VARCHAR(MAX),
	                @SelectQuery20      NVARCHAR(MAX);
	        
	        SELECT @SelectQuery20 = STUFF(
	                   (
	                       SELECT ',' + QUOTENAME(al.AccountLevelID)
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
			SET @JoinQuery = '';
	        SET @SelectQuery = '';
	        SET @GroupByQuery = '';
	        SET @Query = '';
	        SET @SelectQuery2 = '';
	        SET @SelectQuery3 = '';
	        SET @JoinQuery2 = '';
	        
	        SELECT @Columns = STUFF(
	                   (
	                       SELECT DISTINCT ','
	                              + QUOTENAME(al.AccountLevelID)
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @ColumnsUnpivot = STUFF(
	                   (
	                       SELECT DISTINCT ','
	                              + QUOTENAME(al.AccountLevelID)
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @SelectQuery2 = STUFF(
	                   (
	                       SELECT DISTINCT ',DL'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + '.Code as ALDL'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + '_CODE,DL'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + '.Title as ALDL'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + '_TITLE'
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @JoinQuery2 = STUFF(
	                   (
	                       SELECT ' Left outer join Acc.Dl Dl'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + ' on Dl'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + '.DlID=TCurrent.ALDL'
	                              + CAST(al.AccountLevelID AS VARCHAR(2))
	                              + ' '
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1 --OR @NonDlAccountLevelIDs=1
	                              FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @SelectQuery = STUFF(
	                   (
	                       SELECT ','
	                              + CASE 
	                                     WHEN al.AccountLevelTypeID IN (2, 3) --عدد صحيح و اعشاري
	                                          THEN 'Cast( abs(Sum('
	                                          + 'case when debit > 0 then Cast(vial.'
	                                          + QUOTENAME(al.AccountLevelID)
	                                          + ' as decimal(30,4)  ) else -Cast(vial.'
	                                          + QUOTENAME(al.AccountLevelID)
	                                          + ' as decimal(30,4)  ) end)) as NVarchar(Max)) as '
	                                          + QUOTENAME(al.AccountLevelID)
	                                     ELSE 'vial.'
	                                          + QUOTENAME(CAST(al.AccountLevelID AS NVARCHAR(10)))
	                                END
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );

	        SELECT @SelectQuery3 = STUFF(
	                   (
	                       SELECT ', AlDL'
	                              + CAST(al.AccountLevelID AS NVARCHAR(10))
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1
	                              OR  al.AccountLevelID IN (SELECT VALUE
	                                                        FROM   CFG.R_FnCommaStr2Table(@NonDlAccountLevelIDs))
	                                  FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @GroupByQuery = STUFF(
	                   (
	                       SELECT ', vial.'
	                              + QUOTENAME(CAST(al.AccountLevelID AS NVARCHAR(10)))
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1 --OR @NonDlAccountLevelIDs=1
	                              FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        SELECT @JoinQuery = STUFF(
	                   (
	                       SELECT ' AND TCurrent.ALDL'
	                              + CAST(al.AccountLevelID AS NVARCHAR(10))
	                              + '= First.ALDL'
	                              + CAST(al.AccountLevelID AS NVARCHAR(10))
	                       FROM   ACC.AccountLevel al
	                       WHERE  al.AccountLevelTypeID = 1 --OR @NonDlAccountLevelIDs=1
	                              FOR XML PATH(''), TYPE
	                   ).value('.', 'NVARCHAR(MAX)'),
	                   1,
	                   1,
	                   ''
	               );
	        
	        IF @Columns IS NULL
	           OR @Columns = ''
	            SET @Query = 
	                '
	                	select BranchID,SlId,CurrencyID,Sum(Debit) as debit,Sum(credit) as Credit,
	                		Sum(CurrencyDebit) as Currencydebit,Sum(Currencycredit) as CurrencyCredit,
	                		Row_number() over(Order By SlId) as Rno
	                		into ##Exportation
	                		 from #T
	                		
	                		Group By BranchID,SlId,CurrencyID
	                		having(sum(debit)-sum(credit)<>0)
	                	' ;
	        ELSE
	        SET @Query = 
	            '
	                	select BranchID,SlId,CurrencyID,Sum(Debit) as debit,Sum(credit) as Credit,
	                		Sum(CurrencyDebit) as Currencydebit,Sum(Currencycredit) as CurrencyCredit,
	                		' + @SelectQuery + 
	            ',Row_number() over(Order By SlId) as Rno
	                		into ##Exportation
	                		 from #T
	                		 Left JOIN (
	                						 SELECT VoucherItemID,'
	            + @SelectQuery20
	            + 
	            '  FROM 
	       (
	                SELECT alvi.VoucherItemID,
	                       alvi.AccountLevelID,
	                       CASE 
	                            WHEN DLID IS NOT NULL THEN CAST( DLID AS NVARCHAR(2048))
	                            WHEN DLID IS NULL THEN VALUE
	                       END VALUE
	                FROM Acc.AccountLevelVoucherItem alvi 
	                INNER JOIN Acc.AccountLevel al ON 
	                al.AccountLevelID = alvi.AccountLevelID
	                INNER JOIN Acc.VoucherItem vi ON vi.VoucherItemID = alvi.VoucherItemID
					INNER JOIN #T v ON v.VoucherItemID = vi.VoucherItemID
	            ) x
	            PIVOT(
	                MAX(VALUE)
	                FOR AccountLevelID IN (' + @Columns
	            + 
	            ')
	            ) p
	            
	                		 
	                		 ) vial
							ON #T.VoucherItemID=vial.VoucherItemID
	                		Group By BranchID,SlId,CurrencyID,'
	            + @GroupByQuery
	            + '
	                		having(sum(debit)-sum(credit)<>0)
	                	' ;
	   
	    EXECUTE (@Query);
		
	    if not exists (select * from  ##Exportation )
			BEGIN	       
	        
	        RAISERROR( 'حسابهای دائم دوره مالی مورد نظر دارای مانده نیستند و نیازی به صدور سند اختتامیه نیست.', 16, 12);
	        
	        RETURN;
	    END;
	    
	    SET @Query = N'
	                		insert into Acc.VoucherItem
							SELECT  ' + CAST(@VoucherID AS VARCHAR(50))
	        + ',Rno,Slid,' + @ClosingStr + ','
	        + @ClosingStr
	        + 
	        ',
							case when credit > debit THEN credit-debit ELSE 0 end  ,
							case when credit< debit THEN debit-credit ELSE 0 end ,CurrencyID,
							case when (CurrencyDebit- CurrencyCredit) <> 0 then  
							ABS((debit-credit) /(CurrencyDebit- CurrencyCredit)) else 0 end, 							
							case when Currencycredit > Currencydebit THEN Currencycredit-Currencydebit ELSE 0 end  ,
							case when Currencycredit< Currencydebit THEN Currencydebit-Currencycredit ELSE 0 END,'
	        + CAST(@Creator AS VARCHAR(50))
	        + ',GETDATE(),'
	        + CAST(@Creator AS VARCHAR(50))
	        + ',GETDATE(),0
							 FROM ##Exportation';

	    EXECUTE (@Query);
	    
	    IF @Columns IS NOT NULL
	       AND @Columns <> ''
	    BEGIN
	        SET @Query = 
	            '  SELECT *
	                	into ##Unpivot
								FROM   (
										SELECT *
										FROM   ##Exportation
									)P UNPIVOT(VALUE FOR AccountLevelID IN ('
	            + @ColumnsUnpivot
	            + ')) AS unpvt ';
	        
	        EXECUTE (@Query);
	        
	        SET @Query = 
	            'INSERT INTO acc.AccountLevelVoucherItem(VoucherItemID, AccountLevelID, DlID,
									[Value], Creator, CreationDate, LastEditor, LastEditionDate,Version)
	                	select VoucherItemID,T.AccountLevelID,case when AccountLevelTypeID =1 then VALUE Else Null END,
							case when AccountLevelTypeID <>1 then VALUE Else Null END,'
	            + CAST(@Creator AS VARCHAR(50))
	            + ',GETDATE(),'
	            + CAST(@Creator AS VARCHAR(50))
	            + 
	            ',GETDATE(),1
	                	 FROM ##Unpivot T
	                	 Inner join Acc.AccountLevel al
	                	 on al.AccountLevelID=T.AccountLevelID
	                	Inner join 
	                	(select * from acc.VoucherItem where VoucherID='
	            + CAST(@VoucherID AS VARCHAR(50))
	            + ' )VoucherItem on 
	                	 T.Rno=VoucherItem.VoucherItemIndex ';
	        
	        EXECUTE (@Query);
	    END;
	END;
	END;
	ELSE 
	IF (@DocumentTypeEngName = 'Opening') --افتتاحيه
	BEGIN
	    DECLARE @PreviousFinancialperiodId INT,
	            @DocumentTypeIDForClosing SMALLINT,
	            @DocumentTypeIDForOpening SMALLINT;
	    
	    SELECT @DocumentTypeIDForClosing = DocumentTypeID
	    FROM   ACC.DocumentType dt
	    WHERE  dt.engname = 'Closing';
	    
	    SELECT @DocumentTypeIDForOpening = DocumentTypeID
	    FROM   ACC.DocumentType dt
	    WHERE  dt.engname = 'Opening';
	    
	    SELECT TOP 1 @PreviousFinancialperiodId = fp.FinancialPeriodID
	    FROM   CFG.FinancialPeriod fp
	    WHERE  fp.EndDate < @FStartDate
	    ORDER BY
	           fp.EndDate DESC;
	    
	    IF NOT EXISTS (
	           SELECT 1
	           FROM   ACC.Voucher v
	           WHERE  v.BranchID = @BranchId
	                  AND v.FinancialPeriodID = @PreviousFinancialperiodId
	                  AND v.DocumentTypeID = @DocumentTypeIDForClosing
	       )
	    BEGIN
	        RAISERROR('ACC_spExportationOpeningOrClosingVoucher_5', 16, 12);
	        RETURN;
	    END;
	ELSE
	BEGIN
	    --گرفتن اقلام سند افتتاحيه و صدور سند افتتاحيه
	    -- تذکر : اقلام سند افتتاحيه , ميشه عين اقلام سند اختتاميه دوره ي قبل, فقط بايد مقدار بدهکار و بستانکار عوض(جابجا) بشه
	    --Insert Voucher
	    INSERT INTO [ACC].[Voucher]
	      (
	        [BranchID],
	        [FinancialPeriodID],
	        [DocumentTypeID],
	        [Number],
	        [ReferenceNumber],
	        [DailyNumber],
	        [SubNumber],
	        [Date],
	        [VoucherStatusID],
	        [Description],
	        [Description2],
	        [Total],
	        [Creator],
	        [CreationDate],
	        [Version],
	        [LastEditor],
	        [LastEditionDate],
			[AutoGenerated]
	      )
	    VALUES
	      (
	        @BranchId,
	        @FinicialPeriodID,
	        @DocumentTypeID,
	        (
	            SELECT ISNULL(MAX(Number), 0) + 1
	            FROM   [ACC].[Voucher] as v
				INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	            WHERE  FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	        ),
	            
	        (
	            SELECT ISNULL(MAX(v.ReferenceNumber),0) + 1
	            FROM   [ACC].[Voucher] v
				INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	            WHERE  FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	        ),
	            
	        (
	            SELECT ISNULL(MAX(DailyNumber), 0) + 1
	            FROM   [ACC].[Voucher] v
				INNER JOIN [CFG].Branch AS b ON b.BranchID=v.BranchID
	            WHERE  [Date] = @Date
	                    AND FinancialPeriodID = @FinicialPeriodID AND b.CompanyID=@CompanyID
	        ),
	        NULL,
	        @Date,
	        1,
	        @Opening,
	        @Opening,
	        0,
	        @Creator,
	        GETDATE(),
	        0,
	        @Creator,
	        GETDATE(),
			1
	      );
	    
	    SET @VoucherID = SCOPE_IDENTITY();
	    --جاي Credit  و Debit بايد
	    -- متفاوت باشد
	    INSERT INTO ACC.VoucherItem
	      (
	        VoucherID,
	        VoucherItemIndex,
	        SlID,
	        DESCRIPTION,
	        Description2,
	        Credit,
	        Debit,
	        CurrencyID,
	        CurrencyRate,
	        CurrencyDebit,
	        CurrencyCredit,
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	      )
	    SELECT @VoucherID,
	           vi.VoucherItemIndex,
	           vi.SlID,
	           @Opening,
	           @Opening,
	           vi.Debit,
	           vi.Credit,
	           vi.CurrencyID,
	           vi.CurrencyRate,
	           vi.CurrencyCredit,
	           vi.CurrencyDebit,
	           @Creator,
	           GETDATE(),
	           @Creator,
	           GETDATE(),
	           1
	    FROM   ACC.Voucher v
	           INNER JOIN ACC.VoucherItem vi
	                ON  vi.VoucherID = v.VoucherID
	    WHERE  v.BranchID = @BranchId
	           AND v.FinancialPeriodID = @PreviousFinancialperiodId
	           AND v.DocumentTypeID = @DocumentTypeIDForClosing;
	    
	    INSERT INTO ACC.AccountLevelVoucherItem
	      (
	        VoucherItemID,
	        AccountLevelID,
	        DlID,
	        [Value],
	        Creator,
	        CreationDate,
	        LastEditor,
	        LastEditionDate,
	        Version
	      )
	    SELECT vi2.VoucherItemID,
	           alvi.AccountLevelID,
	           alvi.DlID,
	           alvi.[Value],
	           @Creator,
	           GETDATE(),
	           @Creator,
	           GETDATE(),
	           1
	    FROM   ACC.AccountLevelVoucherItem alvi
	           INNER JOIN ACC.VoucherItem vi
	                ON  vi.VoucherItemID = alvi.VoucherItemID
	           INNER JOIN ACC.Voucher v
	                ON  v.VoucherID = vi.VoucherID
	           INNER JOIN ACC.VoucherItem vi2
	                ON  vi.VoucherItemIndex = vi2.VoucherItemIndex
	           INNER JOIN ACC.Voucher v2
	                ON  v2.VoucherID = vi2.VoucherID
	           Inner join acc.AccountLevel AS al on al.AccountLevelID = alvi.AccountLevelID     
	    WHERE  v.BranchID = @BranchId
	           AND v2.VoucherID = @VoucherID
	           AND v.FinancialPeriodID = @PreviousFinancialperiodId
	           AND v.DocumentTypeID = @DocumentTypeIDForClosing --?????
	           AND v2.FinancialPeriodID = @FinicialPeriodID
	           AND v2.DocumentTypeID = @DocumentTypeIDForOpening;
	END;
	END;
	
	UPDATE ACC.Voucher
	SET    Total = (
	           SELECT SUM(Debit)
	           FROM   ACC.VoucherItem AS vi
	           WHERE  vi.VoucherID = @VoucherID
	       )
	WHERE  VoucherID = @VoucherID;
	
	SELECT Number
	FROM   ACC.Voucher v
	WHERE  v.VoucherID = @VoucherID;
	
	END;
	ELSE
	BEGIN
		IF (@DocumentTypeEngName = 'Closing')
		BEGIN
		    RAISERROR('ACC_spExportationOpeningOrClosingVoucher_6', 16, 12);
		    RETURN;
		END;
		ELSE 
		IF (@DocumentTypeEngName = 'Opening')
		BEGIN
		    RAISERROR('ACC_spExportationOpeningOrClosingVoucher_7', 16, 12);
		    RETURN;
		END;
	END;
