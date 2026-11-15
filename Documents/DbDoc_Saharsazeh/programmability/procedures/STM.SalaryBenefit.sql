
---------------------------------------------------------------
CREATE    PROC [STM].SalaryBenefit
    @ID NVARCHAR(MAX),
    @Parameterid INT = NULL,
	@ParameteridsForIgnor int = null

--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Culture VARCHAR(10),
            @CulturenO INT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CulturenO = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    CREATE TABLE #Ids
    (
        id INT NOT NULL
    );

    INSERT INTO #Ids
    (
        id
    )
    SELECT [value]
    FROM CFG.R_FnCommaStr2Table(@ID);

    ---------------------------------------------------
    SELECT c.AgreementID,
           CASE
               WHEN @CulturenO = 1 THEN
                   d.Title
               WHEN @CulturenO = 2 THEN
                   d.Title2
           END ParameterTitle,
           a.Amount,
		   a.ParameterID,
		   d.CalculationTypeID,
		   d.Code
    FROM HRM.Agreement c
        JOIN HRM.AgreementParameter a
            ON a.AgreementID = c.AgreementID
        JOIN PAY.Parameter d
            ON d.ParameterID = a.ParameterID 
        JOIN HRM.Personel a2
            ON a2.PersonelID = c.PersonelID
        LEFT JOIN PAY.ParameterOrder po
            ON po.ParameterID = a.ParameterID
               AND po.OrderType = 0
    WHERE EXISTS
			(
				SELECT id FROM #Ids WHERE id = c.AgreementID
			)
          AND
          (
              @Parameterid IS NULL
              OR d.ParameterID = @Parameterid
          )
		  and
		  (
		  @ParameteridsForIgnor is null
		  or
		  d.ParameterID not in 
		  (
		      SELECT [value]
				FROM CFG.R_FnCommaStr2Table(@ParameteridsForIgnor)
		)
		  )
    ORDER BY po.OrderIndex;

END;
