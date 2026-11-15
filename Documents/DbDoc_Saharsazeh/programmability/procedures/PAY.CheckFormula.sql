
---------------------------------------------------------
CREATE   PROCEDURE [PAY].[CheckFormula](@InParameterId INT, @InEmploymentTypeId INT,@CalendarMonthID int)

--WITH ENCRYPTION
AS
	SELECT *
	INTO   #SelParameter2
	FROM   (
	           SELECT cmd.*,
	                  p.CategoryID,
	                  p.ParameterTypeID,
	                  p.SystemName,
	                  p.CalculationTypeID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY p.ParameterID,
	                      EmploymentTypeID ORDER BY cm.StartDate 
	                      DESC
	                  ) RNO
	           FROM   pay.CalculationMethod cmd
	                  INNER JOIN PAY.Parameter p
	                       ON  p.ParameterID = cmd.ParameterID
	                  INNER JOIN HRM.CalendarMonth cm
	                       ON  cm.CalendarMonthID = cmd.EfficientCalendarMonthID
	           WHERE  cmd.GenerateCalendarMonthID = @CalendarMonthID 
	           and  (@InParameterId IS NULL OR @InParameterId = P.ParameterID)
	                  AND (
	                          @InEmploymentTypeId IS NULL
	                          OR @InEmploymentTypeId = EmploymentTypeID
	                      )
	       ) T
	WHERE  T.RNO = 1              
	
	SELECT e.CalculationAggregateExpressionID,
	       p.ParameterID,
	       T.value  AS ParameterValueTypeID,
	       p.EmploymentTypeID,
	       p.CalculationTypeID
	INTO   #AGGDependency
	FROM   pay.CalculationAggregateExpression e
	       INNER JOIN #SelParameter2 p
	            ON  (e.IsTaxable IS NULL OR p.IsTaxable = e.IsTaxable)
	            AND (
	                    e.IsInsuranceable IS NULL
	                    OR p.IsInsuranceable = e.IsInsuranceable
	                )
	            AND (
	                    e.CategoryItems IS NULL
	                    OR ',' + e.CategoryItems LIKE '%,' + CAST(p.CategoryID AS VARCHAR(10))
	                       + '%'
	                )
	            AND (
	                    e.ParameterTypeItems IS NULL
	                    OR ',' + e.ParameterTypeItems LIKE '%,' + CAST(p.ParameterTypeID AS VARCHAR(10))
	                       + '%'
	                )
	       OUTER APPLY (
	    SELECT VALUE
	    FROM   cfg.R_FnCommaStr2Table(e.ParameterValueTypeItems) rfcst
	)                  T
	WHERE  NOT (P.SystemName IS NOT NULL AND p.SystemName LIKE 'NS_%')
	
	DELETE #AGGDependency
	WHERE  ParameterValueTypeID <> 7
	--SELECT * from #AGGDependency
	
	SELECT cm.ParameterID,
	       cm.EmploymentTypeID,
	       f.FormulaID
	INTO   #T
	FROM   #SelParameter2 cm
	       INNER JOIN pay.Formula f
	            ON  f.CalculationMethodID = cm.CalculationMethodID
	ORDER BY
	       cm.ParameterID
	
	DECLARE @ParameterID          INT,
	        @EmploymentTypeID     INT,
	        @FormulaID            INT
	
	CREATE TABLE #T2
	(
		Id              INT IDENTITY,
		ParameterID     INT,
		FormulaID       INT,
		Parentids       VARCHAR(MAX),
		IsCheck         TINYINT DEFAULT 0
	)
	
	DECLARE R CURSOR 
	FOR
	    SELECT *
	    FROM   #T
	
	OPEN R
	
	FETCH NEXT FROM R
	INTO @ParameterID,@EmploymentTypeID,@FormulaID                                                            
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    DECLARE @RowCOunt INT
	    
	    -- PRINT 'Start'
	    TRUNCATE TABLE #T2
	    
	    INSERT INTO #T2
	    SELECT @ParameterID,
	           @FormulaID,
	           @ParameterID,
	           0
	    
	    SET @RowCOunt = 1
	    
	    WHILE @RowCOunt <> 0
	    BEGIN
	        UPDATE #T2
	        SET    IsCheck = 2
	        WHERE  IsCheck = 0

	        INSERT INTO #T2
	        SELECT DISTINCT T21.ParameterID,
	               t21.FormulaID2,
	               #t2.Parentids + ',' + CAST(T21.ParameterID AS VARCHAR(10)),
	               0
	        FROM   (
	                   SELECT *
	                   FROM   (
	                              SELECT fp.FormulaID,
	                                     fp.ParameterID,
	                                     fp.ParameterValueTypeID,
	                                     f.FormulaID AS FormulaID2
	                              FROM   pay.FormulaParameter fp
	                                     INNER JOIN pay.CalculationMethod cm
	                                          ON  cm.ParameterID = fp.ParameterID
	                                          AND (
	                                                  @EmploymentTypeID is Null
	                                                  OR cm.EmploymentTypeID = @EmploymentTypeID
	                                              )
	                                     INNER JOIN pay.Formula f
	                                          ON  f.CalculationMethodID = cm.CalculationMethodID
	                          )T
	                   UNION 
	                   (
	                       SELECT fp.FormulaID,
	                              #AGGDependency.ParameterID,
	                              #AGGDependency.ParameterValueTypeID,
	                              f.FormulaID AS FormulaID2
	                       FROM   pay.FormulaParameter fp
	                              INNER JOIN #AGGDependency
	                                   ON  fp.CalculationAggregateFunctionID = 
	                                       #AGGDependency.CalculationAggregateExpressionID
	                              INNER JOIN pay.CalculationMethod cm
	                                   ON  cm.ParameterID = #AGGDependency.ParameterID
	                                   AND (
	                                           @EmploymentTypeID is Null
	                                           OR cm.EmploymentTypeID = @EmploymentTypeID
	                                       )
	                              INNER JOIN pay.Formula f
	                                   ON  f.CalculationMethodID = cm.CalculationMethodID
	                              INNER JOIN pay.Formula f2
	                                   ON  f2.FormulaID = fp.FormulaID
	                              INNER JOIN pay.CalculationMethod cm2
	                                   ON  f2.CalculationMethodID = cm2.CalculationMethodID
	                              INNER JOIN pay.Parameter p
	                                   ON  p.ParameterID = cm2.ParameterID
	                       WHERE  p.CalculationTypeID = #AGGDependency.CalculationTypeID
	                   )
	               )T21
	               INNER JOIN #T2
	                    ON  #T2.FormulaID = T21.FormulaID
	               INNER JOIN pay.Parameter
	                    ON  pay.Parameter.ParameterID = T21.ParameterID
	               INNER JOIN pay.Parameter p2
	                    ON  p2.ParameterID = #T2.ParameterID
	        WHERE  T21.ParameterValueTypeID = 7
	               AND #T2.IsCheck = 2
	               AND pay.Parameter.CalculationTypeID = P2.CalculationTypeID
	        
	        SET @RowCOunt = @@ROWCOUNT
	        
	        IF EXISTS(
	               SELECT T.ParameterID,
	                      VALUE
	               FROM   (
	                          SELECT *
	                          FROM   #T2
	                                 OUTER APPLY cfg.R_FnCommaStr2Table(#t2.Parentids) 
	                          rfcst
	                      )
	                      T
	               GROUP BY
	                      Id,
	                      T.ParameterID,
	                      VALUE
	               HAVING (COUNT(*) > 1)
	           )
	        BEGIN
	            SELECT T.ParameterID--,
	                                -- VALUE
	            FROM   (
	                       SELECT *
	                       FROM   #T2
	                              OUTER APPLY cfg.R_FnCommaStr2Table(#t2.Parentids) 
	                       rfcst
	                   )
	                   T
	            GROUP BY
	                   Id,
	                   T.ParameterID,
	                   VALUE
	            HAVING (COUNT(*) > 1)
	            
	            
	            --SELECT * FROM #t2
	            RETURN
	        END 

	        UPDATE #T2
	        SET    IsCheck     = 1
	        WHERE  IsCheck     = 2
	    END 
	    
	    FETCH NEXT FROM R
	    INTO @ParameterID,
	       @EmploymentTypeID,
	       @FormulaID
	
	END
	
	CLOSE R
	DEALLOCATE R
	
	SELECT 0 AS ParameterID
	WHERE  1 = 0;
