
------------------------------------- START #8142
CREATE   PROCEDURE [HRM].[UpdateAgreementBatchModelFormulaParameters]
(@FormulaID INT, @Expr VARCHAR(MAX), @DeletePreviousRecords BIT)

--WITH ENCRYPTION
AS
	DECLARE @result     VARCHAR(MAX),
	        @pos        INT,
	        @Index      INT,
	        @Str        VARCHAR(MAX)
	
	SET @pos = 1
	SET @Index = 1
	SET @Str = ''
	
	SET @result = ''

	                             
	IF @Expr IS NULL
	   OR LTRIM(RTRIM(@Expr)) = ''
	    RETURN
	ELSE
	BEGIN
		IF @DeletePreviousRecords = 1
		BEGIN
			DELETE
			FROM hrm.AgreementBatchModelFormulaParameter 
			WHERE AgreementBatchModelFormulaID = @FormulaID
		END

	    WHILE (@Index <= LEN(@Expr))
	    BEGIN
	        IF (LEN(@Expr) > @index AND SUBSTRING(@Expr, @Index, 2) = 'PP')
	        BEGIN
	            IF @Str <> ''
	                SET @result = @result + @Str
	            
	            SET @pos = CHARINDEX('PP', @Expr, @Index)
	            IF (@pos < 0)
	                BREAK
	            
	            DECLARE @pos2 INT   
	            SET @pos2 = CHARINDEX('PP', @Expr, @pos + 1)
	            DECLARE @expr2 VARCHAR(MAX)
	            SET @expr2 = SUBSTRING(@Expr, @pos, @pos2 - @pos + 2)
	            SET @expr2 = REPLACE(@expr2, 'PP', '')
	            
	            
	            IF SUBSTRING(@expr2, 1, 2) = 'F_'
	            BEGIN
	                SET @result = @result + (
	                        SELECT cf.SqlExpression
	                        FROM   PAY.CalculationFunction cf
	                        WHERE  cf.CalculationFunctionID = CAST(SUBSTRING(@expr2, 3, LEN(@expr2) -2) AS INT)
	                    )
	            END
	            ELSE
	            IF LEN(@expr2) > 9
	               AND SUBSTRING(@expr2, 1, 9) = 'KEYVALUE_'
	            BEGIN
	                SET @result = @result + cfg.GetStringPartBySpliter(@expr2, 3, '_')
	            END
	            ELSE 
	            
	            IF SUBSTRING(@expr2, 1, 2) = 'E_'
	            BEGIN
	            	
	                IF NOT EXISTS 
	                   (
	                       SELECT *
	                       FROM   hrm.AgreementBatchModelFormulaParameter 
	                       WHERE AgreementBatchModelFormulaID = @FormulaID
	                              AND CalculationAggregateFunctionID = SUBSTRING(@expr2, 3, LEN(@expr2) -2)
	                   )
	                    INSERT INTO hrm.AgreementBatchModelFormulaParameter
	                      (
	                        AgreementBatchModelFormulaID,
	                        ParameterID,
	                        ParameterValueTypeID,
	                        CalculationAggregateFunctionID,
	                        Version,
	                        Creator,
	                        CreationDate,
	                        LastEditor,
	                        LastEditionDate
	                      )
	                    SELECT @FormulaID,
	                           NULL,
	                           NULL,
	                           SUBSTRING(@expr2, 3, LEN(@expr2) -2),
	                           0,
	                           -1,
	                           GETDATE(),
	                           -1,
	                           GETDATE()
	            END
	            ELSE
	            BEGIN
	                DECLARE @parameterTypeId INT,
	                        @UbderPos        INT,
	                        @parameterid     INT
	                
	                SET @UbderPos = CHARINDEX('_', @expr2)
	                
	                IF @UbderPos = 0
	                BEGIN
	                    SET @parameterTypeId = @expr2
	                    SET @parameterid = NULL
	                    IF NOT EXISTS 
	                       (
	                           SELECT *
	                           FROM   Hrm.AgreementBatchModelFormulaParameter
	                           WHERE  AgreementBatchModelFormulaID = @FormulaID
	                                  AND (ParameterID IS NULL)
	                                  AND @parameterTypeId = 
	                                      ParameterValueTypeID
	                       )
	                        INSERT INTO hrm.AgreementBatchModelFormulaParameter
	                          (
	                            AgreementBatchModelFormulaID,
	                            ParameterID,
	                            ParameterValueTypeID,
	                            CalculationAggregateFunctionID,
	                            Version,
	                            Creator,
	                            CreationDate,
	                            LastEditor,
	                            LastEditionDate
	                          )
	                        SELECT @FormulaID,
	                               @parameterid,
	                               @parameterTypeId,
	                               NULL,
	                               0,
	                               -1,
	                               GETDATE(),
	                               -1,
	                               GETDATE()
	                END
	                ELSE
	                BEGIN
	                    SET @parameterTypeId = SUBSTRING(@expr2, 1, @UbderPos -1)
	                    SET @parameterid = SUBSTRING(@expr2, @UbderPos + 1, LEN(@expr2) -@UbderPos)
	                    
	                    IF NOT EXISTS 
	                       (
	                           SELECT *
	                           FROM   Hrm.AgreementBatchModelFormulaParameter 
	                           WHERE  AgreementBatchModelFormulaID = @FormulaID
	                                  AND (ParameterID = @parameterid)
	                                  AND @parameterTypeId = 
	                                      ParameterValueTypeID
	                       )
	                      -- AND EXISTS (SELECT 1 FROM pay.Parameter AS p WHERE p.ParameterID=@parameterid)
	                        INSERT INTO hrm.AgreementBatchModelFormulaParameter
	                          (
	                            AgreementBatchModelFormulaID,
	                            ParameterID,
	                            ParameterValueTypeID,
	                            CalculationAggregateFunctionID,
	                            Version,
	                            Creator,
	                            CreationDate,
	                            LastEditor,
	                            LastEditionDate
	                          )
	                        SELECT @FormulaID,
	                               @parameterid,
	                               @parameterTypeId,
	                               NULL,
	                               0,
	                               -1,
	                               GETDATE(),
	                               -1,
	                               GETDATE()
	                END
	            END
	            
	            SET @index = @pos2 + 2
	            SET @str = ''
	        END
	        ELSE
	        BEGIN
	            SET @Str = @Str + SUBSTRING(@Expr, @Index, 1)
	            SET @Index = @Index + 1
	        END
	    END
	END
