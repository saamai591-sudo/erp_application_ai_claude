
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v6.3.153
 * Time: 07/16/2015 01:40:49 ب.ظ
 ************************************************************/

CREATE PROCEDURE [HRM].[GetBaseValueDataForList]
--with encryption
AS
	SELECT T.BaseValueID,
	       T.PaymentSystemID,
	       T.ApplyDate,
	       bv.Title  AS BaseValueTitle,
	       ps.Title  AS PaymentSystemTitle,
	       CFG.GetCLRSaturnDate(T.ApplyDate,'YYYY/MM/DD',0,0) AS ApplyDateString
	       	FROM   (
	           SELECT DISTINCT bvd.BaseValueID,
	                  bvd.PaymentSystemID,
	                  bvd.ApplyDate
	           FROM   hrm.BaseValueData bvd
	       )T
	       INNER JOIN hrm.BaseValue bv
	            ON  bv.BaseValueID = T.BaseValueID
	       INNER JOIN hrm.PaymentSystem ps
	            ON  ps.PaymentSystemID = T.PaymentSystemID



