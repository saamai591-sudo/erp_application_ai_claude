CREATE PROCEDURE [FSS].[CalcFinancialStatement]
    (
      @FinancialStatementID INT
    )
AS
    DECLARE @FinancialPeriodID INT ,
        @ToDate DATE;


    SELECT  @FinancialPeriodID = FinancialPeriodID ,
            @ToDate = ToDate
    FROM    FSS.FinancialStatement
    WHERE   FinancialStatementID = @FinancialStatementID;

    CREATE TABLE #Columns
        (
          ReportId INT ,
          [ReportColumnID] INT ,
          [ColumnType] TINYINT ,
          [ReportDataType] TINYINT
        );


    CREATE TABLE #Calc
        (
          ReportId INT ,
          [ReportColumnID] INT ,
          [TopicID] INT ,
          [DlID] BIGINT ,
          [Value] DECIMAL(18, 4) ,
          TopicReportStructureID INT ,
          ItemValueTypeID INT
        );


    INSERT  INTO #Columns
            ( ReportId ,
              ReportColumnID ,
              ColumnType ,
              ReportDataType
            )
            SELECT  Report.ReportID ,
                    ReportColumnID ,
                    ColumnType ,
                    DataType
            FROM    FSS.Report
                    INNER JOIN FSS.ReportColumn ON ReportColumn.ReportID = Report.ReportID
            WHERE   FinancialStatementID = @FinancialStatementID;


			
		

	
--محاسبه گزارشات از نوع کدینگ
    INSERT  INTO #Calc
            ( ReportId ,
              ReportColumnID ,
              TopicID ,
              DlID ,
              [Value] ,
              ItemValueTypeID
	        )
            SELECT  ReportId ,
                    ReportColumnID ,
                    NULL ,
                    DlID ,
                    SUM([Value]) ,
                    1
            FROM    ( SELECT    ReportId ,
                                SOURCE.ReportColumnID ,
                                SOURCE.DlID ,
                                CASE SOURCE.ColumnType
                                  WHEN 1
                                  THEN  --مقداری
                                       CASE DataType
                                         WHEN 1
                                         THEN SUM(CASE WHEN DocumentTypeID = 2
                                                            AND Rno = 1
                                                       THEN Debit - Credit
                                                       ELSE 0
                                                  END)
                                               --اول دوره
                                         WHEN 2
                                         THEN SUM(CASE WHEN Rno = 1
                                                       THEN Debit - Credit
                                                       ELSE 0
                                                  END)
                                                  --مانده
                                         WHEN 3
                                         THEN SUM(CASE WHEN DocumentTypeID <> 2
                                                            AND Rno = 1
                                                       THEN Debit
                                                       ELSE 0
                                                  END)
                                                    --گردش بدهکار 
                                         WHEN 4
                                         THEN SUM(CASE WHEN DocumentTypeID <> 2
                                                            AND Rno = 1
                                                       THEN Credit
                                                       ELSE 0
                                                  END) --گردش بستانکار
                                       END
                                  WHEN 2 THEN NULL -- مقایسه ای
                                  WHEN 3 THEN NULL -- دستی
                                END AS [Value]
                      FROM      ( SELECT    Debit ,
                                            DocumentTypeID ,
                                            Credit ,
                                            DlID ,
                                            T.DataType ,
                                            T.ReportId ,
                                            T.ReportColumnID ,
                                            T.ColumnType ,
                                            ROW_NUMBER() OVER ( PARTITION BY ACC.VoucherItem.VoucherItemID ORDER BY AccountLevelVoucherItemID ) AS Rno
                                  FROM      ACC.Voucher
                                            INNER JOIN ACC.VoucherItem ON VoucherItem.VoucherID = Voucher.VoucherID
                                            INNER JOIN ACC.AccountLevelVoucherItem AccountLevelVoucherItem ON AccountLevelVoucherItem.VoucherItemID = VoucherItem.VoucherItemID
                                            INNER JOIN ( SELECT
                                                              AccountLevelID ,
                                                              SlID ,
                                                              #Columns.ReportId ,
                                                              #Columns.ReportColumnID ,
                                                              ColumnType ,
                                                              DataType,
															  FSS.CodingReportStructure.DocumentTypeIds
                                                         FROM FSS.CodingReportStructure
                                                              INNER JOIN FSS.CodingReportStructureSl ON CodingReportStructureSl.CodingReportStructureID = CodingReportStructure.CodingReportStructureID
                                                              INNER JOIN FSS.CodingReportStructureSlReportColumn ON CodingReportStructureSlReportColumn.CodingReportStructureSlID = CodingReportStructureSl.CodingReportStructureSlID
                                                              INNER JOIN #Columns ON #Columns.ReportColumnID = CodingReportStructureSlReportColumn.ReportColumnID
                                                         WHERE
                                                              ReportDataType = 1
                                                       ) T ON T.AccountLevelID = AccountLevelVoucherItem.AccountLevelID
                                                              AND T.SlID = ACC.VoucherItem.SlID
															  AND ','+T.DocumentTypeIds+',' LIKE  '%,'+CAST(DocumentTypeID AS VARCHAR(10)) + ',%'  
                                  WHERE     FinancialPeriodID = @FinancialPeriodID
                                            AND Date <= @ToDate
                                          
                                ) SOURCE
                      WHERE     SOURCE.Rno = 1
                      GROUP BY  SOURCE.DlID ,
                                SOURCE.DataType ,
                                SOURCE.ReportId ,
                                SOURCE.ReportColumnID ,
                                SOURCE.ColumnType
                    ) T
            GROUP BY DlID ,
                    ReportId ,
                    ReportColumnID;


--درج رکوردهای مریوط یه ستونهای دستی و مقایسه ای
	INSERT INTO #calc(ReportId,ReportColumnID,TopicID,DlID,Value,TopicReportStructureID,ItemValueTypeID)
	SELECT  FSS.ReportColumn.ReportID,ReportColumnID,NULL,T.DlID,NULL,NULL,1 FROM 
	FSS.Report
	INNER JOIN FSS.ReportColumn
	ON ReportColumn.ReportID = Report.ReportID
	Inner JOIN 
	(
		SELECT DISTINCT ReportId,DlID FROM #Calc
		WHERE DlId IS NOT null
	)T
	ON T.ReportId=FSS.Report.ReportID
	WHERE FinancialStatementID=@FinancialStatementID
	AND ColumnType IN (2,3)
	AND FSS.Report.DataType=1


	--بروز رسانی مقایسه ای ها

	


    UPDATE  #Calc
    SET     Value = FSS.ReportResult.Value
    FROM    #Calc
            INNER JOIN #Columns ON #Columns.ReportColumnID = #Calc.ReportColumnID
            INNER JOIN FSS.ReportColumn ON ReportColumn.ReportColumnID = #Columns.ReportColumnID
            INNER JOIN FSS.ReportResult ON ReportResult.ReportColumnID = ReportColumn.ComparativeColumnID
                                           AND ReportResult.DlID = #Calc.DlID
    WHERE   #Columns.ColumnType = 2;


	--درج جمع ها برای استفاده در فرمول

    INSERT  INTO #Calc
            ( ReportId ,
              ReportColumnID ,
              TopicID ,
              DlID ,
              Value ,
              TopicReportStructureID ,
              ItemValueTypeID
            )
            SELECT  ReportId ,
                    ReportColumnID ,
                    NULL ,
                    NULL ,
                    SUM(Value) ,
                    ReportColumnID ,
                    3
            FROM    #Calc
            WHERE   DlID IS NOT NULL
            GROUP BY ReportId ,
                    ReportColumnID;




				

	--محاسبه سرفصل های از نوع کدینگ

				--------------
    INSERT  INTO #Calc
            ( ReportId ,
              ReportColumnID ,
              TopicID ,
              DlID ,
              [Value] ,
              TopicReportStructureID ,
              ItemValueTypeID	
	        )
            SELECT  ReportId ,
                    ReportColumnID ,
                    TopicID ,
                    NULL ,
                    SUM([Value]) ,
                    NULL ,
                    1
            FROM    ( SELECT    ReportId ,
                                ReportColumnID ,
                                TopicID ,
                                CASE ColumnType
                                  WHEN 1
                                  THEN  --مقداری
                                       CASE DataType
                                         WHEN 1
                                         THEN SUM(CASE WHEN DocumentTypeID = 2
                                                            AND Rno = 1
                                                       THEN Debit - Credit
                                                       ELSE 0
                                                  END)
                                               --اول دوره
                                         WHEN 2
                                         THEN SUM(CASE WHEN Rno = 1
                                                       THEN Debit - Credit
                                                       ELSE 0
                                                  END)
                                                  --مانده
                                         WHEN 3
                                         THEN SUM(CASE WHEN DocumentTypeID <> 2
                                                            AND Rno = 1
                                                       THEN Debit
                                                       ELSE 0
                                                  END)
                                                    --گردش بدهکار 
                                         WHEN 4
                                         THEN SUM(CASE WHEN DocumentTypeID <> 2
                                                            AND Rno = 1
                                                       THEN Credit
                                                       ELSE 0
                                                  END) --گردش بستانکار
                                       END
                                  WHEN 2 THEN NULL -- مقایسه ای
                                  WHEN 3 THEN NULL -- دستی
                                END AS [Value]
                      FROM      ( SELECT    Debit ,
                                            Credit ,
                                            TopicID ,
                                            T.DataType ,
                                            T.ReportId ,
                                            T.ReportColumnID ,
                                            T.ColumnType ,
                                            DocumentTypeID ,
                                            ROW_NUMBER() OVER ( PARTITION BY ReportColumnID, ACC.VoucherItem.VoucherItemID ORDER BY AccountLevelVoucherItemID ) AS Rno
                                  FROM      ACC.Voucher
                                            INNER JOIN ACC.VoucherItem ON VoucherItem.VoucherID = Voucher.VoucherID
                                            Left JOIN ACC.AccountLevelVoucherItem AccountLevelVoucherItem ON AccountLevelVoucherItem.VoucherItemID = VoucherItem.VoucherItemID
                                            INNER JOIN ( SELECT
                                                              AccountLevelID ,
                                                              SlID ,
                                                              #Columns.ReportId ,
                                                              #Columns.ReportColumnID ,
                                                              ColumnType ,
                                                              TopicID ,
                                                              DlID ,
                                                              DataType,
															  FSS.TopicReportStructure.DocumentTypeIds
                                                         FROM FSS.TopicReportStructure
                                                              INNER JOIN FSS.TopicReportStructureCoding ON TopicReportStructureCoding.TopicReportStructureID = TopicReportStructure.TopicReportStructureID
                                                                INNER JOIN #Columns ON #Columns.ReportColumnID = TopicReportStructure.ReportColumnID
															  Left JOIN FSS.TopicReportStructureCodingAccountLevel ON TopicReportStructureCodingAccountLevel.TopicReportStructureCodingID = TopicReportStructureCoding.TopicReportStructureCodingID
                                                            
                                                         WHERE
                                                              ReportDataType = 2
                                                       ) T ON (
														ISNULL(T.AccountLevelID,-1) =ISNULL( AccountLevelVoucherItem.AccountLevelID,-1)
														OR
														T.AccountLevelID IS null
														)
                                                              AND T.SlID = ACC.VoucherItem.SlID
                                                              AND
															  (ISNULL(T.DlID,-1) =ISNULL( AccountLevelVoucherItem.DlID,-1)
															  OR
															  T.DlID IS null
															  )
                                                               AND ','+T.DocumentTypeIds+',' LIKE  '%,'+CAST(DocumentTypeID AS VARCHAR(10)) + ',%'  
                                  WHERE     FinancialPeriodID = @FinancialPeriodID
                                            AND Date <= @ToDate
                                           
                                ) Source
                      WHERE     Source.Rno = 1
                      GROUP BY  TopicID ,
                                DataType ,
                                ReportId ,
                                ReportColumnID ,
                                ColumnType
                    ) T
            GROUP BY TopicID ,
                    ReportId ,
                    ReportColumnID;




    UPDATE  #Calc
    SET     TopicReportStructureID = FSS.TopicReportStructure.TopicReportStructureID
    FROM    #Calc
            INNER JOIN FSS.TopicReportStructure ON TopicReportStructure.ReportColumnID = #Calc.ReportColumnID
                                                   AND TopicReportStructure.TopicID = #Calc.TopicID
    WHERE   ItemValueTypeID = 1;



	INSERT INTO #calc(ReportId,ReportColumnID,TopicID,DlID,Value,TopicReportStructureID,ItemValueTypeID)
	SELECT  FSS.ReportColumn.ReportID,ReportColumnID,TopicId,Null,NULL,NULL,1 FROM 
	FSS.Report
	INNER JOIN FSS.ReportColumn
	ON ReportColumn.ReportID = Report.ReportID
	INNER JOIN FSS.Topic
	ON Topic.ParentReportID = Report.ReportID
	WHERE FinancialStatementID=@FinancialStatementID
	AND ColumnType IN (2,3)
	AND FSS.Report.DataType=2
	AND topic.DataType<>1

--محاسبه سرفصل های از نوع فرمول


    ALTER TABLE #Calc
    ADD ParameterFullID INT;

   

    INSERT  INTO #Calc
            ( ReportId ,
              ReportColumnID ,
              TopicID ,
              DlID ,
              Value ,
              TopicReportStructureID ,
              ItemValueTypeID
            )
            SELECT  ReportId ,
                    #Columns.ReportColumnID ,
                    TopicID ,
                    NULL ,
                    NULL ,
                    TopicReportStructureID ,
                    1
            FROM    FSS.TopicReportStructure
                    INNER JOIN #Columns ON #Columns.ReportColumnID = TopicReportStructure.ReportColumnID
            WHERE   CalculationType = 1;


    UPDATE  #Calc
    SET     parameterFullId = CAST(TopicReportStructureID AS DECIMAL(18, 0))
            * 1000000 + CAST(ItemValueTypeID AS DECIMAL(18, 0));


    CREATE TABLE #SelParameterFormula
        (
          TopicReportStructureID INT ,
          SQLExpression NVARCHAR(MAX)
        );
	
    INSERT  INTO #SelParameterFormula
            SELECT  TopicReportStructureID ,
                    FormulaSqlExpression
            FROM    FSS.TopicReportStructure
                    INNER JOIN #Columns ON #Columns.ReportColumnID = TopicReportStructure.ReportColumnID
            WHERE   CalculationType = 1
                    AND FormulaSqlExpression <> ''
                    AND FormulaSqlExpression IS NOT NULL;
		
	

	 				

	

    CREATE TABLE #Dep
        (
          Orig INT ,
          dep INT ,
          ItemValueTypeID INT
        );	


    INSERT  INTO #Dep
            SELECT  TopicReportStructureID ,
                    RelatedTopicReportStructureID ,
                    ItemValueTypeID
            FROM    FSS.TopicReportStructureFormulaPrameter;
	
    DECLARE @TopicReportStructureID INT;
    DECLARE @SQlExpr NVARCHAR(MAX);
	       


    WHILE ( SELECT  COUNT(*)
            FROM    #SelParameterFormula
          ) <> 0
        BEGIN
    
            SELECT  @TopicReportStructureID = TopicReportStructureID
            FROM    #SelParameterFormula
            WHERE   NOT EXISTS ( SELECT *
                                 FROM   #Dep
                                 WHERE  ItemValueTypeID = 1
                                        AND Orig = #SelParameterFormula.TopicReportStructureID
                                        AND EXISTS ( SELECT 1
                                                     FROM   #SelParameterFormula d
                                                     WHERE  d.TopicReportStructureID = #Dep.dep ) );


            SELECT  @SQlExpr = FormulaSqlExpression
            FROM    FSS.TopicReportStructure
            WHERE   TopicReportStructureID = @TopicReportStructureID;
			
            IF EXISTS ( SELECT  1
                        FROM    #Dep
                        WHERE   Orig = @TopicReportStructureID
                                AND ItemValueTypeID = 2 )
                BEGIN
                   	--درج جمع ها برای استفاده در فرمول

					
					
                    INSERT  INTO #Calc
                            ( ReportId ,
                              ReportColumnID ,
                              TopicID ,
                              DlID ,
                              Value ,
                              TopicReportStructureID ,
                              ItemValueTypeID ,
                              parameterFullId
                            )
                            SELECT  ReportId ,
                                    ReportColumnID ,
                                    NULL ,
                                    NULL ,
                                    SUM(Value) ,
                                    ReportColumnID ,
                                    2 ,
                                    CAST(ReportColumnID AS DECIMAL(18, 0))
                                    * 1000000 + CAST(2 AS DECIMAL(18, 0))
                            FROM    #Calc
                            WHERE   TopicID IS NOT NULL
							AND ReportColumnID IN (
								SELECT  Dep
								FROM    #Dep
								WHERE   Orig = @TopicReportStructureID
                                AND ItemValueTypeID = 2
							)
							AND NOT EXISTS (
								SELECT 1 FROM #calc c
								WHERE ItemValueTypeID=2
								AND c.ReportColumnID= #Calc.ReportColumnID
							)
                            GROUP BY ReportId ,
                                    ReportColumnID;

                END;

				
            DECLARE @usedParameters VARCHAR(MAX) ,
                @usedAggregate VARCHAR(MAX) ,
                @usedSelectParameters VARCHAR(MAX) ,
                @usedSelectAggregate VARCHAR(MAX) ,
                @joinParameter VARCHAR(MAX) ,
                @JoinAggregate VARCHAR(MAX) ,
                @Q VARCHAR(MAX);
							
			
            SET @Q = @SQlExpr;				  
			
            SELECT  @usedParameters = STUFF(
	                           (SELECT  ','
                                        + QUOTENAME(CAST(CAST(ISNULL(fp.RelatedTopicReportStructureID,
                                                              0) AS DECIMAL(18,
                                                              0)) * 1000000
                                                    + CAST(fp.ItemValueTypeID AS DECIMAL(18,
                                                              0)) AS VARCHAR(1024)))
                                FROM    FSS.TopicReportStructureFormulaPrameter fp
                                WHERE   TopicReportStructureID = @TopicReportStructureID
                    FOR                     XML PATH('') ,
                                                TYPE
	                           ).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

 


            SELECT  @usedSelectParameters = STUFF(
	                           (SELECT  ','
                                        + QUOTENAME(CAST(CAST(ISNULL(fp.RelatedTopicReportStructureID,
                                                              0) AS DECIMAL(18,
                                                              0)) * 1000000
                                                    + CAST(fp.ItemValueTypeID AS DECIMAL(18,
                                                              0)) AS VARCHAR(1024)))
                                        + ' as ' + QUOTENAME('P'
                                                             + CAST(CAST(ISNULL(fp.RelatedTopicReportStructureID,
                                                              0) AS DECIMAL(18,
                                                              0)) * 1000000
                                                             + CAST(fp.ItemValueTypeID AS DECIMAL(18,
                                                              0)) AS VARCHAR(1024)))
                                FROM    FSS.TopicReportStructureFormulaPrameter fp
                                WHERE   TopicReportStructureID = @TopicReportStructureID
                    FOR                           XML PATH('') ,
                                                      TYPE
	                           ).value('.', 'NVARCHAR(MAX)'), 1, 1, '');


                
            IF @usedParameters IS NOT NULL
                SET @joinParameter = ' Left JOIN (
							 SELECT TopicReportStructureID,'
                    + @usedSelectParameters
                    + '
							FROM  (SELECT TopicReportStructureID, ParameterFullID, [Value]
							 from #calc) t20
							 PIVOT(SUM(Value)
							FOR ParameterFullID IN(' + @usedParameters
                    + ')
							) AS PivotSales
							)T
							ON T.TopicReportStructureID=#calc.TopicReportStructureID';	


            SET @Q = 'Update #calc Set Value=(select Round(' + @Q + ','
                + CASE WHEN 1 = 0 THEN '0'
                       ELSE '4'
                  END + ') ';
	                
            IF @usedAggregate IS NOT NULL
                OR @usedParameters IS NOT NULL
                SET @Q = @Q + 'from (
							 SELECT ' + @usedSelectParameters + '
							FROM  (SELECT  ParameterFullID, [Value]
							 from #calc) t20
							 PIVOT(SUM(Value)
							FOR ParameterFullID IN(' + @usedParameters + ')
							) AS PivotSales
							)T';
			

            SET @Q = @Q + ') where ItemValueTypeId=1 AND #calc.TopicReportStructureID='
                + CAST(@TopicReportStructureID AS VARCHAR(10));
				
			
            BEGIN TRY
                PRINT @TopicReportStructureID;
             
                PRINT @TopicReportStructureID;	
                PRINT @Q;
              

			  

			 
                EXEC (@Q);
               

                DELETE  #SelParameterFormula
                WHERE   TopicReportStructureID = @TopicReportStructureID;
            END TRY
            BEGIN CATCH
	                	--ROLLBACK
                DECLARE @ErrorSeverity INT ,
                    @ErrorMessage2 NVARCHAR(MAX) ,
                    @error NVARCHAR(MAX) ,
                    @ErrorState INT;
	                	
                SET @ErrorSeverity = ERROR_SEVERITY();
                SET @ErrorMessage2 = ERROR_MESSAGE();
                SET @ErrorState = ERROR_STATE();
	                	
	                	
	                	
                SET @error = 'E_' + ' بروز خطا در محاسبه  ' + @ErrorMessage2;
	                	
                RAISERROR (
	                	    @error,	-- Message text.
	                	    @ErrorSeverity,	-- Severity,
	                	    @ErrorState,	-- State,
	                	    NULL,	-- First argument.
	                	    NULL
	                	); -- Second argument.
	                	
                RETURN;
            END CATCH;
        END;


  
--بروز رسانی مقایسه ای ها سرفصل
	
    UPDATE  #Calc
    SET     Value = FSS.ReportResult.Value
    FROM    #Calc
            INNER JOIN #Columns ON #Columns.ReportColumnID = #Calc.ReportColumnID
            INNER JOIN FSS.ReportColumn ON ReportColumn.ReportColumnID = #Columns.ReportColumnID
            INNER JOIN FSS.Topic ON Topic.TopicID = #Calc.TopicID
            INNER JOIN FSS.ReportResult ON ReportResult.ReportColumnID = ReportColumn.ComparativeColumnID
                                           AND ReportResult.TopicID = FSS.Topic.ComparativeTopicID
    WHERE   #Columns.ColumnType = 2;


    DECLARE @UserId INT;
    
    SET @UserId = CFG.GetuserID();


    DELETE  FSS.ReportResult
    FROM    FSS.ReportResult
            INNER JOIN FSS.Report ON Report.ReportID = ReportResult.ReportID
    WHERE   FinancialStatementID = @FinancialStatementID;

    INSERT  INTO FSS.ReportResult
            ( ReportID ,
              ReportColumnID ,
              TopicID ,
              DlID ,
              Value ,
              VERSION ,
              Creator ,
              CreationDate ,
              LastEditor ,
              LastEditionDate
	        )
            SELECT  ReportId ,
                    ReportColumnID ,
                    TopicID ,
                    DlID ,
                    Value ,
                    1 ,
                    @UserId ,
                    GETDATE() ,
                    @UserId ,
                    GETDATE()
            FROM    #Calc
            WHERE   itemValueTypeID = 1;
