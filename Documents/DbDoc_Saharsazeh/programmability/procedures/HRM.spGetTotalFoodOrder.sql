CREATE   PROC HRM.spGetTotalFoodOrder
    @ServingPlaceId INT,
    @FromDate DATE,
    @ToDate DATE
AS
BEGIN
	DECLARE @UserID                INT,
	        @CurrentPersonelID     INT
	
	SET @UserID = cfg.GetuserID();
	
	SELECT @CurrentPersonelID = p.PersonelID FROM hrm.Personel AS p
	JOIN cfg.[User] AS u ON p.PartyID=u.PartyID
	WHERE u.UserID = @UserID
	
	DROP TABLE IF EXISTS #res;
	
	DROP TABLE  IF EXISTS #EmployerShareData;
	
	DECLARE @TotalOrder        DECIMAL(30, 4),
	        @EmployeeShare     DECIMAL(30, 4) = NULL
	
	SELECT foi.Amount,
	       fo.[Date],
	       foi.FoodID
	INTO   #orders
	FROM   HRM.FoodOrder fo
	       JOIN HRM.FoodOrderItem AS foi
	            ON  foi.FoodOrderID = fo.FoodOrderID
	WHERE  fo.PersonnelID = @CurrentPersonelID
	       AND fo.Date BETWEEN @FromDate AND @ToDate
	
	
	CREATE TABLE #EmployerShareData
	(
		
		PersonelID INT,
		EmployeeCost       DECIMAL(30, 10),
		FoodPrice          DECIMAL(30, 10),
		DATE                DATE,
	)
	
	INSERT INTO #EmployerShareData
	(
		PersonelID,
		EmployeeCost,
		FoodPrice,
		[DATE]
		--  -- this column value is auto-generated
	)
	EXEC hrm.GetEmployeeSharePerDate
		@FromDate = @FromDate,
		@EndDate = @ToDate,
		@All = 0
		
	SELECT @TotalOrder = ISNULL(SUM(Amount), 0)
	FROM   #orders
	
				SELECT @EmployeeShare = ISNULL(SUM(EmployeeCost), 0)
	FROM   #EmployerShareData;
	
		select @TotalOrder as Value, isnull(@EmployeeShare, 0) as Value1;
		
		
	IF OBJECT_ID('tempdb..#EmployerShareData') IS NOT NULL
        DROP TABLE #EmployerShareData;
        
        END
