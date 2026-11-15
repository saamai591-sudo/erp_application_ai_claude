/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.1.261
 * Time: 7/17/2017 11:45:46 AM
 ************************************************************/

CREATE PROCEDURE [CTM].[CheckShoppingCard](
    @id               INT,
    @fromSerialNo     INT,
    @ToSerialNo       INT,
    @IssueDate        DATE,
    @ExpireDate       DATE
)
AS
	IF @fromSerialNo > @ToSerialNo
	BEGIN
		 RAISERROR(
	        'شماره های وارد شده معتبر نمی باشند .',
	        16,
	        12
	    )
	END
	IF @issueDate > @expireDate
	BEGIN
		 RAISERROR(
	        'تاریخ های وارد شده معتبر نمی باشند .',
	        16,
	        12
	    )
	END
	IF EXISTS (
	       SELECT 1
	       FROM   Ctm.ShoppingCart AS sc
	       WHERE  sc.ShoppingCartID <> @id
	              AND (
	                      (
	                          @fromSerialNo BETWEEN sc.FromSerialNumber AND sc.ToSerialNumber
	                          AND (
	                                  @IssueDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                  OR @ExpireDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                  OR sc.IssueDate BETWEEN @IssueDate AND @ExpireDate
	                                  OR sc.[ExpireDate] BETWEEN @IssueDate AND @ExpireDate
	                              )
	                      )
	                      OR (
	                             @ToserialNo BETWEEN sc.FromSerialNumber AND sc.ToSerialNumber
	                             AND (
	                                     @IssueDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR @ExpireDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR sc.IssueDate BETWEEN @IssueDate AND @ExpireDate
	                                     OR sc.[ExpireDate] BETWEEN @IssueDate AND @ExpireDate
	                                 )
	                         )
	                      OR (
	                             sc.FromSerialNumber BETWEEN @fromSerialNo AND @ToserialNo
	                             AND (
	                                     @IssueDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR @ExpireDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR sc.IssueDate BETWEEN @IssueDate AND @ExpireDate
	                                     OR sc.[ExpireDate] BETWEEN @IssueDate AND @ExpireDate
	                                 )
	                         )
	                      OR (
	                             sc.ToSerialNumber BETWEEN @fromSerialNo AND @ToserialNo
	                             AND (
	                                     @IssueDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR @ExpireDate BETWEEN sc.IssueDate AND sc.[ExpireDate]
	                                     OR sc.IssueDate BETWEEN @IssueDate AND @ExpireDate
	                                     OR sc.[ExpireDate] BETWEEN @IssueDate AND @ExpireDate
	                                 )
	                         )
	                  )
	   )
	    RAISERROR(
	        'با توجه به تاریخ های انتخاب شده، شماره سریال ها تکراری می باشند .',
	        16,
	        12
	    )
	
	RETURN;
	
